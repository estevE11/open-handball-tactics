import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  FilePlus2,
  FolderPlus,
  HardDrive,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { db, library } from "./lib/browserStorage";
import { newProject } from "./lib/projectDefaults";
import { exportProject, importProject } from "./lib/projectIo";
import { snapshot } from "./lib/snapshot";
import { fitPoint } from "./lib/courtGeometry";
import { flushSaves, useProjectStore } from "./store/projectStore";
import { useAssetUrls } from "./hooks/useAssetUrls";
import { FolderTree } from "./components/library/FolderTree";
import { TacticalCanvas } from "./components/board/TacticalCanvas";
import { Toolbar } from "./components/app/Toolbar";
import { AnimationPanel } from "./components/app/AnimationPanel";
import { WorkspaceSettings } from "./components/app/WorkspaceSettings";
import { ThemeToggle } from "./components/app/ThemeToggle";
import { usePreferencesStore } from "./store/preferencesStore";
import { Inspector } from "./components/app/Inspector";
import { Modal } from "./components/ui/Modal";
import type { DrillProject, FolderNode, Point } from "./types/project";

type Dialog =
  | { type: "new" | "folder" | "details" | "export" | "help" | "preferences" }
  | { type: "manage"; folder: FolderNode };

function createProject(title?: string, folderId: string | null = null) {
  return newProject(
    title,
    folderId,
    usePreferencesStore.getState().courtDefaults,
  );
}

export default function App() {
  const board = useProjectStore();
  const { project, frameIndex, edit } = board;
  const projects =
    useLiveQuery(
      () => db.projects.orderBy("updatedAt").reverse().toArray(),
      [],
    ) ?? [];
  const folders = useLiveQuery(() => db.folders.toArray(), []) ?? [];
  const { assets, urls } = useAssetUrls();
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [onion, setOnion] = useState(false);
  const [activePane, setActivePane] = useState<"editor" | "animation">(
    "editor",
  );
  const [sidebar, setSidebar] = useState(false);
  const [settings, setSettings] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const input = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        await db.open();
        void navigator.storage?.persist?.().catch(() => {});
        let initial = await db.projects.orderBy("updatedAt").last();
        if (!initial) {
          initial = createProject("Build the attack");
          initial.tags = ["Positional play", "First team"];
          initial.description =
            "Explore a 3:3 attack against a compact 6:0 defense. Move players, draw a trajectory, or choose a different formation.";
          await db.transaction("rw", db.projects, db.folders, async () => {
            // Initialization is atomic; a second tab reuses the first tab’s drill.
            const existing = await db.projects.orderBy("updatedAt").last();
            if (existing) initial = existing;
            else await library.save(initial!);
          });
        }
        useProjectStore.getState().open(initial);
      } catch (error) {
        setNotice(
          `Could not open local storage: ${error instanceof Error ? error.message : error}`,
        );
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!sidebar) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebar(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebar]);
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    return () => {
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
    };
  }, []);
  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable], dialog",
        )
      )
        return;
      const state = useProjectStore.getState();
      if (state.playbackTime !== null) {
        if (event.key === "Escape") state.stopPlayback();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      }
      if (event.key.toLowerCase() === "v" || event.key === "Escape")
        state.setTool("select");
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        state.selected
      ) {
        event.preventDefault();
        state.edit((d) => {
          const f = d.keyframes[state.frameIndex];
          f.tokens = f.tokens.filter((t) => t.id !== state.selected);
          f.arrows = f.arrows.filter((a) => a.id !== state.selected);
          const used = new Set(
            d.keyframes.flatMap((f) => f.tokens.map((t) => t.assetId)),
          );
          d.customAssets = d.customAssets.filter((a) => used.has(a.id));
        });
        state.setSelected(null);
      }
    }
    function unload(e: BeforeUnloadEvent) {
      if (useProjectStore.getState().saveStatus !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("keydown", keys);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  function folderPath(id: string | null): string {
    const parts: string[] = [];
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const f = folders.find((f) => f.id === id);
      if (!f) break;
      parts.unshift(f.name);
      id = f.parentId;
    }
    return parts.join(" / ");
  }
  async function openProject(p: DrillProject) {
    await flushSaves();
    const latest = await db.projects.get(p.id);
    if (!latest) throw new Error("This drill has been deleted.");
    board.open(latest);
    setSidebar(false);
  }
  function addAsset(id: string, position: Point) {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    edit((d) => {
      if (!d.customAssets.some((a) => a.id === id))
        d.customAssets.push({ id, name: asset.name, blobUri: `asset:${id}` });
      d.keyframes[frameIndex].tokens.push({
        id: crypto.randomUUID(),
        role: "equipment",
        shape: "square",
        label: asset.name.slice(0, 80),
        color: "#ffffff",
        size: 24,
        position: fitPoint(position, d.courtConfig, 24),
        equipment: "image",
        assetId: id,
      });
    });
  }
  const visible = projects.filter(
    (p) =>
      (!folder || p.folderId === folder) &&
      `${p.title} ${p.tags.join(" ")} ${folderPath(p.folderId)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function deleteCurrent() {
    if (
      !project ||
      !window.confirm(`Delete “${project.title}”? This cannot be undone.`)
    )
      return;
    await flushSaves();
    await library.deleteProject(project.id);
    let next = await db.projects.orderBy("updatedAt").last();
    if (!next) {
      next = createProject();
      await library.save(next);
    }
    board.open(next);
    setDialog(null);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const parentId = String(form.get("parent") ?? "") || null;
    await run(async () => {
      await flushSaves();
      if (dialog?.type === "new") {
        const next = createProject(name, parentId);
        await library.save(next);
        board.open(next);
        setSidebar(false);
      }
      if (dialog?.type === "folder") {
        const next = await library.createFolder(name, parentId);
        setFolder(next.id);
      }
      if (dialog?.type === "manage")
        await library.updateFolder(dialog.folder.id, name, parentId);
      if (dialog?.type === "details" && project) {
        const next = {
          ...project,
          title: name,
          folderId: parentId,
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          description: String(form.get("description") ?? ""),
        };
        await library.save(next);
        board.open(next);
      }
      setDialog(null);
    });
  }
  const isForm =
    dialog && ["new", "folder", "manage", "details"].includes(dialog.type);
  const parentSelect = (defaultValue: string | null) => (
    <label>
      Folder
      <select name="parent" defaultValue={defaultValue ?? ""}>
        <option value="">Root</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {folderPath(f.id)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="app-shell">
      <aside
        id="library-sidebar"
        className={`library-sidebar ${sidebar ? "open" : ""}`}
        aria-hidden={!sidebar}
      >
        <a className="brand" href="/" aria-label="Open Handball Tactics home">
          <img src="/icon.svg" alt="" />
          <div>
            Open Handball<span>TACTICS</span>
          </div>
          <span className="version">BETA</span>
        </a>
        <div className="library-heading">
          <span>YOUR WORKSPACE</span>
          <button
            className="icon-button"
            aria-label="Create folder"
            onClick={() => setDialog({ type: "folder" })}
          >
            <FolderPlus size={16} />
          </button>
        </div>
        <div className="folder-tree">
          <FolderTree
            folders={folders}
            projects={projects}
            active={folder}
            onSelect={setFolder}
            onManage={(f) => setDialog({ type: "manage", folder: f })}
          />
        </div>
        <div className="drill-library">
          <div className="section-heading">
            <h3>
              {folder
                ? folders.find((f) => f.id === folder)?.name
                : "Drill library"}
            </h3>
            <button
              className="icon-button"
              aria-label="New drill"
              onClick={() => setDialog({ type: "new" })}
            >
              <Plus size={16} />
            </button>
          </div>
          <label className="search">
            <Search size={14} />
            <input
              placeholder="Search drills, tags…"
              aria-label="Search drills"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={12} />
              </button>
            )}
          </label>
          <div className="drill-list">
            {visible.map((p) => (
              <button
                key={p.id}
                className={`drill-card ${p.id === project?.id ? "active" : ""}`}
                onClick={() => void run(() => openProject(p))}
              >
                <div className="mini-court">
                  <span />
                  <i />
                  <b />
                </div>
                <div className="drill-card-info">
                  <strong>{p.title}</strong>
                  <span>
                    {p.tags[0] || "Handball drill"}
                    <span>
                      {" "}
                      · {p.keyframes.length}{" "}
                      {p.keyframes.length === 1 ? "step" : "steps"}
                    </span>
                  </span>
                </div>
                {p.id === project?.id && <span className="active-dot" />}
              </button>
            ))}
            {!visible.length && (
              <div className="empty-library">
                {query
                  ? "No drills match your search."
                  : "A fresh space for your next idea."}
                <button
                  className="text-button"
                  onClick={() => setDialog({ type: "new" })}
                >
                  <Plus size={14} /> Create a drill
                </button>
              </div>
            )}
          </div>
          <button
            className="new-drill"
            onClick={() => setDialog({ type: "new" })}
          >
            <Plus size={16} /> New drill
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className="text-button"
            onClick={() => input.current?.click()}
          >
            <ArrowUpFromLine size={15} /> Import .hbd project
          </button>
          <button
            className="storage-card"
            onClick={() => setDialog({ type: "help" })}
          >
            <div className="storage-icon">
              <HardDrive size={18} />
            </div>
            <div>
              <strong>Made to stay yours</strong>
              <span>Saved locally. No account needed.</span>
            </div>
            <ShieldCheck size={14} />
          </button>
          <div className="ecosystem">
            <span>PART OF OPEN HANDBALL</span>
            <a
              href="https://open-handball-video.vercel.app"
              target="_blank"
              rel="noreferrer"
            >
              Video ↗
            </a>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close library"
          onClick={() => setSidebar(false)}
        />
      )}
      <main className="main-workspace">
        <header className="topbar">
          <div className="topbar-main">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle library"
              aria-expanded={sidebar}
              aria-controls="library-sidebar"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb topbar-context">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>
                {project
                  ? folderPath(project.folderId) || "All drills"
                  : "Loading"}
              </strong>
            </div>
            {project && (
              <div className="topbar-drill">
                <h1>{project.title}</h1>
                <button
                  className="icon-button"
                  aria-label="Drill details"
                  onClick={() => setDialog({ type: "details" })}
                >
                  <MoreHorizontal size={19} />
                </button>
                {project.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            {project && (
              <>
                <span className="save-status" role="status">
                  {board.saveStatus === "saved" && <Check size={12} />}{" "}
                  {board.saveStatus === "saved"
                    ? "All changes saved"
                    : board.saveStatus === "saving"
                      ? "Saving…"
                      : "Save failed"}
                </span>
                <button
                  className="button secondary duplicate-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await flushSaves();
                      board.open(await library.duplicate(project));
                    })
                  }
                >
                  <Copy size={15} /> Duplicate
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    board.setSelected(null);
                    setDialog({ type: "export" });
                  }}
                >
                  <ArrowDownToLine size={15} /> Export <ChevronDown size={12} />
                </button>
              </>
            )}
            <button
              className="icon-button mobile-settings"
              aria-label="Toggle settings"
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={19} />
            </button>
            <ThemeToggle onError={setNotice} />
            <span className="offline-status">
              <span />
              {offline
                ? "Working offline"
                : offlineReady
                  ? "Ready offline"
                  : "Local workspace"}
            </span>
            <button
              className="icon-button"
              aria-label="Workspace defaults"
              title="Workspace defaults"
              onClick={() => setDialog({ type: "preferences" })}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setDialog({ type: "help" })}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        {notice && (
          <div className="notice" role="alert">
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {board.error && (
          <div className="notice" role="alert">
            Changes aren’t saved: {board.error}
            <button onClick={board.retry}>Retry save</button>
          </div>
        )}
        {needRefresh && (
          <div className="notice">
            An update is ready.
            <button
              onClick={() =>
                void run(async () => {
                  await flushSaves();
                  await updateServiceWorker(true);
                })
              }
            >
              Save & update
            </button>
          </div>
        )}
        {project ? (
          <>
            <div className="editor-layout">
              <div className="board-column">
                <div className="pane-switch-row">
                  <button
                    className="pane-switch"
                    onClick={() =>
                      setActivePane((pane) =>
                        pane === "editor" ? "animation" : "editor",
                      )
                    }
                  >
                    Switch to {activePane === "editor" ? "animation" : "editor"}{" "}
                    pane
                  </button>
                </div>
                <div inert={board.playbackTime !== null}>
                  <Toolbar />
                </div>
                <div
                  className="canvas-area"
                  style={{
                    backgroundColor:
                      project.courtConfig.background === "floor"
                        ? project.courtConfig.themeColors.floor
                        : project.courtConfig.background,
                  }}
                >
                  <div className="canvas-topline">
                    <span>
                      <span className="small-dot" />{" "}
                      {project.keyframes[frameIndex].name}
                    </span>
                    <span>
                      {project.courtConfig.type === "full"
                        ? "40 × 20"
                        : `${project.courtConfig.dimensions.width} × ${project.courtConfig.dimensions.height}`}{" "}
                      m
                    </span>
                  </div>
                  <TacticalCanvas
                    assetUrls={urls}
                    onAssetDrop={addAsset}
                    onion={onion}
                  />
                </div>
              </div>
              <div
                className={`inspector-wrap ${settings ? "mobile-open" : ""}`}
              >
                <div
                  className="pane-tabs"
                  role="tablist"
                  aria-label="Workspace pane"
                >
                  <button
                    role="tab"
                    aria-selected={activePane === "editor"}
                    className={activePane === "editor" ? "active" : ""}
                    onClick={() => setActivePane("editor")}
                  >
                    Editor
                  </button>
                  <button
                    role="tab"
                    aria-selected={activePane === "animation"}
                    className={activePane === "animation" ? "active" : ""}
                    onClick={() => setActivePane("animation")}
                  >
                    Animation
                  </button>
                </div>
                {activePane === "editor" ? (
                  <div
                    className="editor-pane"
                    inert={board.playbackTime !== null}
                  >
                    <Inspector
                      assets={assets}
                      urls={urls}
                      upload={(file) =>
                        void run(() => library.uploadAsset(file))
                      }
                      addAsset={addAsset}
                      removeAsset={(id) =>
                        void run(() => library.deleteAsset(id))
                      }
                    />
                  </div>
                ) : (
                  <AnimationPanel onion={onion} setOnion={setOnion} />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="loading">
            {ready ? (
              <>
                <h1>Your court is ready.</h1>
                <button
                  className="button primary"
                  onClick={() => setDialog({ type: "new" })}
                >
                  Create a drill
                </button>
              </>
            ) : (
              "Opening your local workspace…"
            )}
          </div>
        )}
        <footer className="workspace-footer">
          <span>
            OPEN HANDBALL TACTICS <span className="footer-version">v0.2</span>
          </span>
          <span>Your ideas. Your court.</span>
          <span>
            <ShieldCheck size={12} /> Private by design
          </span>
        </footer>
      </main>
      <input
        ref={input}
        type="file"
        accept=".hbd,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              await flushSaves();
              board.open(await importProject(file, folder));
            });
          e.target.value = "";
        }}
      />
      {dialog && (
        <Modal
          title={
            dialog.type === "new"
              ? "Create a drill"
              : dialog.type === "folder"
                ? "Create a folder"
                : dialog.type === "manage"
                  ? "Manage folder"
                  : dialog.type === "details"
                    ? "Drill details"
                    : dialog.type === "export"
                      ? "Take your work with you"
                      : dialog.type === "preferences"
                        ? "Workspace defaults"
                        : "Your local workspace"
          }
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          {notice && (
            <p className="dialog-error" role="alert">
              {notice}
            </p>
          )}
          {dialog.type === "preferences" && (
            <WorkspaceSettings onClose={() => setDialog(null)} />
          )}
          {isForm && (
            <form onSubmit={submit}>
              <label>
                Name
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={
                    dialog.type === "manage"
                      ? dialog.folder.name
                      : dialog.type === "details"
                        ? project?.title
                        : ""
                  }
                  placeholder={
                    dialog.type === "new"
                      ? "e.g. Creating space for the pivot"
                      : "Give it a name"
                  }
                />
              </label>
              {parentSelect(
                dialog.type === "manage"
                  ? dialog.folder.parentId
                  : dialog.type === "details"
                    ? (project?.folderId ?? null)
                    : folder,
              )}
              {dialog.type === "manage" && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await flushSaves();
                      const copy = await library.duplicateFolder(
                        dialog.folder.id,
                      );
                      setFolder(copy.id);
                      setDialog(null);
                    })
                  }
                >
                  <Copy size={14} /> Duplicate folder and its drills
                </button>
              )}
              {dialog.type === "details" && (
                <>
                  <label>
                    Tags
                    <input
                      name="tags"
                      defaultValue={project?.tags.join(", ")}
                      placeholder="U15, Pivot, Warmup"
                    />
                  </label>
                  <label>
                    Coaching notes
                    <textarea
                      name="description"
                      rows={4}
                      maxLength={10000}
                      defaultValue={project?.description}
                    />
                  </label>
                </>
              )}
              <div className="modal-actions">
                {dialog.type === "details" && (
                  <button
                    type="button"
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void run(deleteCurrent)}
                  >
                    <Trash2 size={14} /> Delete drill
                  </button>
                )}
                {dialog.type === "manage" && (
                  <button
                    type="button"
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => {
                      const f = dialog.folder;
                      if (
                        window.confirm(
                          `Delete “${f.name}” and all its folders and drills?`,
                        )
                      )
                        void run(async () => {
                          await flushSaves();
                          await library.deleteFolder(f.id);
                          setFolder(null);
                          if (project && !(await db.projects.get(project.id))) {
                            const next =
                              (await db.projects.orderBy("updatedAt").last()) ??
                              createProject();
                            await library.save(next);
                            board.open(next);
                          }
                          setDialog(null);
                        });
                    }}
                  >
                    <Trash2 size={14} /> Delete folder
                  </button>
                )}
                <button className="button primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : dialog.type === "new" || dialog.type === "folder"
                      ? "Create"
                      : "Save changes"}
                </button>
              </div>
            </form>
          )}
          {dialog.type === "export" && project && (
            <>
              <p className="muted">
                Portable files, ready for your next training session.
              </p>
              <div className="export-options">
                <button
                  disabled={busy}
                  onClick={() => void run(() => exportProject(project))}
                >
                  <FilePlus2 />
                  <div>
                    <strong>
                      Handball project <span>.hbd</span>
                    </strong>
                    <small>Editable backup with every step and image</small>
                  </div>
                  <ArrowDownToLine size={17} />
                </button>
                {(["png", "svg"] as const).map((format) => (
                  <button
                    key={format}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        snapshot(
                          format,
                          project.title,
                          project.courtConfig.background === "floor"
                            ? project.courtConfig.themeColors.floor
                            : project.courtConfig.background,
                        ),
                      )
                    }
                  >
                    <ArrowDownToLine />
                    <div>
                      <strong>{format.toUpperCase()} snapshot</strong>
                      <small>
                        {format === "png"
                          ? "A high-resolution image of this step"
                          : "Scalable vector artwork with embedded images"}
                      </small>
                    </div>
                    <ArrowDownToLine size={17} />
                  </button>
                ))}
              </div>
            </>
          )}
          {dialog.type === "help" && (
            <div className="help-content">
              <p>
                Drills and images live in this browser on this device. After the
                first online visit, the tactics workspace works offline. Nothing you draw is
                uploaded.
              </p>
              <p>
                Use the tools to add players and equipment. Drag to move them,
                or choose an arrow tool and drag across the court. Drag an
                existing arrow to move the whole path; use its endpoints and
                numbered Bézier handles to reshape it. The inspector controls
                arrowheads and lets you add or remove bends.
              </p>
              <p>
                Rotate a selected object with its round handle or the angle
                input. Hold Shift while dragging the handle to snap to 15°. Use
                Add step to copy your positions, then move or rotate players in
                the new step. Play or scrub the timeline to preview their
                movement and rotation. Choose Edit step to resume editing.
              </p>
              <p>
                Workspace defaults in the top bar save your preferred court
                settings and player scale for new drills. The inspector edits
                this drill only. The sun/moon button changes the surrounding
                interface without changing your court colors.
              </p>
              <p>
                Export <strong>.hbd</strong> files as backups or to move drills
                to another browser. Clearing site data removes your local
                library.
              </p>
              <button
                className="button secondary"
                onClick={() =>
                  void run(async () => {
                    const kept = await navigator.storage?.persist?.();
                    setNotice(
                      kept
                        ? "Persistent storage is enabled."
                        : "Your browser did not grant persistent storage. Keep .hbd backups.",
                    );
                    setDialog(null);
                  })
                }
              >
                <ShieldCheck size={15} /> Request persistent storage
              </button>
              <p className="muted">
                PNG, SVG, and editable .hbd exports are available. GIF/WebM
                animation exports and PDF drill sheets are planned for a later
                release.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
