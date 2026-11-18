import { useTranslation } from "./lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Copy,
  FilePlus2,
  FolderPlus,
  HardDrive,
  Menu,
  Maximize,
  Maximize2,
  Minimize,
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
import { copySnapshotImage, snapshot } from "./lib/snapshot";
import { fitPoint } from "./lib/courtGeometry";
import { flushSaves, useProjectStore } from "./store/projectStore";
import { useAssetUrls } from "./hooks/useAssetUrls";
import { useFullscreenWorkspace } from "./hooks/useFullscreenWorkspace";
import { FolderPath } from "./components/library/FolderPath";
import { LibraryContents } from "./components/library/LibraryContents";
import { LibraryExplorer } from "./components/library/LibraryExplorer";
import {
  folderPath as describeFolderPath,
  libraryContents,
} from "./lib/libraryNavigation";
import { TacticalCanvas } from "./components/board/TacticalCanvas";
import { Toolbar } from "./components/app/Toolbar";
import { FullscreenPanel } from "./components/app/FullscreenPanel";
import { DrawingOptions } from "./components/app/DrawingOptions";
import { AnimationPanel } from "./components/app/AnimationPanel";
import { AnimatedExport } from "./components/app/AnimatedExport";
import { WorkspaceSettings } from "./components/app/WorkspaceSettings";
import { ThemeToggle } from "./components/app/ThemeToggle";
import { WorkspaceMenu } from "./components/app/WorkspaceMenu";
import { usePreferencesStore } from "./store/preferencesStore";
import { Inspector } from "./components/app/Inspector";
import { Modal } from "./components/ui/Modal";
import { Collaboration } from "./components/app/Collaboration";
import {
  connectRoom,
  leaveRoom,
  retryRoom,
  roomFromHash,
} from "./lib/collaboration";
import { useCollaborationStore } from "./store/collaborationStore";
import type { DrillProject, FolderNode, Point } from "./types/project";

type Dialog =
  | { type: "export" | "help" | "preferences" }
  | { type: "new" | "folder"; fromExplorer?: boolean }
  | { type: "details"; projectId?: string }
  | { type: "manage"; folder: FolderNode };

function createProject(title?: string, folderId: string | null = null) {
  return newProject(
    title,
    folderId,
    usePreferencesStore.getState().courtDefaults,
  );
}

export default function App() {
  const t = useTranslation();
  const { fullscreen, enterFullscreen, exitFullscreen } =
    useFullscreenWorkspace();
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
  const [explorer, setExplorer] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const {
    onion,
    activePane,
    roomId,
    synced,
    error: roomError,
    connectionHint,
  } = useCollaborationStore();
  const setOnion = (onion: boolean) =>
    useCollaborationStore.setState({ onion });
  const setActivePane = (activePane: "editor" | "animation") =>
    useCollaborationStore.setState({ activePane });
  const [sidebar, setSidebar] = useState(false);
  const [settings, setSettings] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const input = useRef<HTMLInputElement>(null);
  const fullscreenExit = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (fullscreen) fullscreenExit.current?.focus({ preventScroll: true });
  }, [fullscreen]);

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
          initial = createProject(t("Build the attack"));
          initial.tags = [t("Positional play"), t("First team")];
          initial.description = t(
            "Explore a 3:3 attack against a compact 6:0 defense. Move players, draw a trajectory, or choose a different formation.",
          );
          await db.transaction("rw", db.projects, db.folders, async () => {
            // Initialization is atomic; a second tab reuses the first tab’s drill.
            const existing = await db.projects.orderBy("updatedAt").last();
            if (existing) initial = existing;
            else await library.save(initial!);
          });
        }
        useProjectStore.getState().open(initial);
        const room = roomFromHash();
        if (room) await connectRoom(room);
      } catch (error) {
        setNotice(
          `Could not open workspace: ${error instanceof Error ? error.message : error}`,
        );
      }
      setReady(true);
    })();
  }, [t]);

  useEffect(() => {
    if (!sidebar) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.querySelector("dialog[open]") &&
        !(event.target as HTMLElement).closest("dialog")
      )
        setSidebar(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebar]);
  useEffect(() => {
    const joinFromLink = () => {
      const room = roomFromHash();
      if (room?.id === useCollaborationStore.getState().roomId) return;
      void (room ? connectRoom(room) : leaveRoom()).catch((error) => {
        setNotice(error instanceof Error ? error.message : String(error));
      });
    };
    window.addEventListener("hashchange", joinFromLink);
    return () => window.removeEventListener("hashchange", joinFromLink);
  }, []);
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
        document.querySelector("dialog[open]") ||
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
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === "b") state.setTool("draw");
        if (event.key.toLowerCase() === "e") state.setTool("erase");
      }
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
    return describeFolderPath(folders, id);
  }
  function selectFolder(id: string | null) {
    setFolder(id);
    setQuery("");
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
  const contents = libraryContents(folders, projects, folder, query);
  const detailsProject =
    dialog?.type === "details"
      ? !dialog.projectId || dialog.projectId === project?.id
        ? project
        : projects.find((p) => p.id === dialog.projectId)
      : null;
  async function duplicateDrill(target: DrillProject, openCopy: boolean) {
    await flushSaves();
    const latest = await db.projects.get(target.id);
    if (!latest) throw new Error("This drill has been deleted.");
    const copy = await library.duplicate(latest);
    if (openCopy) board.open(copy);
  }
  async function deleteDrill(target: DrillProject) {
    if (
      !window.confirm(
        t("Delete “{v0}”? This cannot be undone.", { v0: target.title }),
      )
    )
      return;
    await flushSaves();
    await library.deleteProject(target.id);
    if (useProjectStore.getState().project?.id === target.id) {
      let next = await db.projects.orderBy("updatedAt").last();
      if (!next) {
        next = createProject();
        await library.save(next);
      }
      board.open(next);
    }
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
        if (dialog.fromExplorer) selectFolder(parentId);
        else {
          board.open(next);
          setSidebar(false);
        }
      }
      if (dialog?.type === "folder") {
        const next = await library.createFolder(name, parentId);
        selectFolder(dialog.fromExplorer ? parentId : next.id);
      }
      if (dialog?.type === "manage")
        await library.updateFolder(dialog.folder.id, name, parentId);
      if (dialog?.type === "details") {
        if (!detailsProject) throw new Error("This drill has been deleted.");
        const metadata = {
          title: name,
          folderId: parentId,
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          description: String(form.get("description") ?? ""),
        };
        if (detailsProject.id === project?.id) {
          edit((draft) => Object.assign(draft, metadata));
          await flushSaves();
        } else {
          const latest = await db.projects.get(detailsProject.id);
          if (!latest) throw new Error("This drill has been deleted.");
          await library.save({ ...latest, ...metadata });
        }
      }
      setDialog(null);
    });
  }
  const isForm =
    dialog && ["new", "folder", "manage", "details"].includes(dialog.type);
  const parentSelect = (defaultValue: string | null) => (
    <label>
      {t("Folder")}
      <select name="parent" defaultValue={defaultValue ?? ""}>
        <option value="">{t("Root")}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {folderPath(f.id)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className={`app-shell ${fullscreen ? "is-fullscreen" : ""}`}>
      <aside
        id="library-sidebar"
        className={`library-sidebar ${sidebar ? "open" : ""}`}
        aria-hidden={!sidebar}
      >
        <a
          className="brand"
          href="/"
          aria-label={t("Open Handball Tactics home")}
        >
          <img src="/icon.svg" alt="" />
          <div>
            {t("Open Handball")}
            <span>{t("TACTICS")}</span>
          </div>
          <span className="version">{t("BETA")}</span>
        </a>
        <div className="library-heading">
          <span>{t("YOUR WORKSPACE")}</span>
          <div className="library-heading-actions">
            <button
              className="icon-button"
              aria-label={t("Open library explorer")}
              title={t("Open library explorer")}
              onClick={() => setExplorer(true)}
            >
              <Maximize2 size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Create folder")}
              onClick={() => setDialog({ type: "folder" })}
            >
              <FolderPlus size={16} />
            </button>
          </div>
        </div>
        <div className="folder-tree">
          <FolderPath
            folders={folders}
            current={folder}
            onSelect={selectFolder}
            onManage={(f) => setDialog({ type: "manage", folder: f })}
          />
        </div>
        <div className="drill-library">
          <div className="section-heading">
            <h3>
              {folder
                ? folders.find((f) => f.id === folder)?.name
                : t("Drill library")}
            </h3>
            <button
              className="icon-button"
              aria-label={t("New drill")}
              onClick={() => setDialog({ type: "new" })}
            >
              <Plus size={16} />
            </button>
          </div>
          <label className="search">
            <Search size={14} />
            <input
              placeholder={t("Search folders, drills, tags…")}
              aria-label={t("Search drills")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label={t("Clear search")}
                onClick={() => setQuery("")}
              >
                <X size={12} />
              </button>
            )}
          </label>
          <div className="drill-list">
            <LibraryContents
              contents={contents}
              selected={project?.id}
              onFolder={selectFolder}
              onProject={(project) => void run(() => openProject(project))}
              onManage={(folder) => setDialog({ type: "manage", folder })}
              onManageProject={(p) =>
                setDialog({ type: "details", projectId: p.id })
              }
              query={query}
              busy={busy}
            />
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            className="text-button"
            onClick={() => input.current?.click()}
          >
            <ArrowUpFromLine size={15} /> {t("Import .hbd project")}
          </button>
          <button
            className="storage-card"
            onClick={() => setDialog({ type: "help" })}
          >
            <div className="storage-icon">
              <HardDrive size={18} />
            </div>
            <div>
              <strong>{t("Made to stay yours")}</strong>
              <span>{t("Saved locally. No account needed.")}</span>
            </div>
            <ShieldCheck size={14} />
          </button>
          <div className="ecosystem">
            <span>{t("PART OF OPEN HANDBALL")}</span>
            <a
              href="https://open-handball-video.vercel.app"
              target="_blank"
              rel="noreferrer"
            >
              {t("Video ↗")}
            </a>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label={t("Close library")}
          onClick={() => setSidebar(false)}
        />
      )}
      <main className="main-workspace">
        <header className="topbar">
          <div className="topbar-main">
            <button
              className="icon-button mobile-menu"
              aria-label={t("Toggle library")}
              aria-expanded={sidebar}
              aria-controls="library-sidebar"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb topbar-context">
              <span>{t("Workspace")}</span>
              <ChevronRight size={13} />
              <strong>
                {project
                  ? folderPath(project.folderId) || t("All drills")
                  : t("Loading")}
              </strong>
            </div>
            {project && (
              <div className="topbar-drill">
                <h1>{project.title}</h1>
                <button
                  className="icon-button"
                  aria-label={t("Drill details")}
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
                    ? t("All changes saved")
                    : board.saveStatus === "saving"
                      ? t("Saving…")
                      : t("Save failed")}
                </span>
                <div
                  className="topbar-primary-actions"
                  role="group"
                  aria-label={t("Drill actions")}
                >
                  <button
                    className="button secondary"
                    aria-label={t("Duplicate")}
                    title={t("Duplicate drill")}
                    disabled={busy}
                    onClick={() =>
                      void run(() => duplicateDrill(project, true))
                    }
                  >
                    <Copy size={16} /> {t("Duplicate")}
                  </button>
                  <Collaboration />
                  <button
                    className="button primary"
                    onClick={() => {
                      board.setSelected(null);
                      setImageCopied(false);
                      setDialog({ type: "export" });
                    }}
                  >
                    <ArrowDownToLine size={16} /> {t("Export")}
                  </button>
                </div>
              </>
            )}
            <div
              className="topbar-utilities"
              role="group"
              aria-label={t("Workspace controls")}
            >
              {project && (
                <button
                  className="icon-button"
                  aria-label={t("Enter fullscreen")}
                  title={t("Fullscreen court")}
                  onClick={() => {
                    setSidebar(false);
                    enterFullscreen();
                  }}
                >
                  <Maximize size={18} />
                </button>
              )}
              <button
                className="icon-button mobile-settings"
                aria-label={t("Toggle settings")}
                onClick={() => setSettings(!settings)}
              >
                <Settings2 size={19} />
              </button>
              <ThemeToggle onError={setNotice} />
              <WorkspaceMenu
                onError={setNotice}
                onPreferences={() => setDialog({ type: "preferences" })}
                onHelp={() => setDialog({ type: "help" })}
                storageStatus={
                  offline
                    ? "Working offline"
                    : offlineReady
                      ? "Ready offline"
                      : "Local workspace"
                }
              />
            </div>
          </div>
        </header>
        {roomId && !synced && (
          <div className="room-waiting">
            <div>
              <h2>{t("Joining live room…")}</h2>
              <p>
                {t(
                  roomError ??
                    connectionHint ??
                    "Keep a coach who has this room open online. Your local library is safe while we connect.",
                )}
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void run(retryRoom)}
              >
                {t("Retry connection")}
              </button>
              <button
                className="button secondary"
                onClick={() => void run(leaveRoom)}
              >
                {t("Cancel joining")}
              </button>
            </div>
          </div>
        )}
        {notice && (
          <div className="notice" role="alert">
            {t(notice)}
            <button
              className="icon-button"
              aria-label={t("Dismiss message")}
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {board.error && (
          <div className="notice" role="alert">
            {t("Changes aren’t saved:")} {t(board.error || "")}
            <button onClick={board.retry}>{t("Retry save")}</button>
          </div>
        )}
        {needRefresh && (
          <div className="notice app-update">
            {t("An update is ready.")}
            <button
              onClick={() =>
                void run(async () => {
                  await flushSaves();
                  await updateServiceWorker(true);
                })
              }
            >
              {t("Save & update")}
            </button>
          </div>
        )}
        {project ? (
          <>
            <div
              className={`editor-layout ${fullscreen ? "fullscreen-workspace" : ""}`}
              data-court-layout={
                project.courtConfig.type === "full" ? "full" : "half"
              }
            >
              {fullscreen && (
                <button
                  ref={fullscreenExit}
                  className="fullscreen-exit icon-button"
                  aria-label={t("Exit fullscreen")}
                  title={t("Exit fullscreen (Esc)")}
                  onClick={exitFullscreen}
                >
                  <Minimize size={18} />
                </button>
              )}
              <div className="board-column">
                <FullscreenPanel
                  enabled={fullscreen}
                  name="Tools"
                  edge={project.courtConfig.type === "full" ? "top" : "left"}
                >
                  <div inert={board.playbackTime !== null}>
                    <Toolbar
                      orientation={
                        fullscreen && project.courtConfig.type !== "full"
                          ? "vertical"
                          : "horizontal"
                      }
                    />
                  </div>
                </FullscreenPanel>
                <div className="board-stage">
                  {!fullscreen && <DrawingOptions />}
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
                        {t("m")}
                      </span>
                    </div>
                    <TacticalCanvas
                      key={`${project.id}:${project.keyframes[frameIndex].id}`}
                      assetUrls={urls}
                      onAssetDrop={addAsset}
                      onion={onion}
                    />
                  </div>
                </div>
              </div>
              <FullscreenPanel
                enabled={fullscreen}
                name="Properties"
                edge={project.courtConfig.type === "full" ? "bottom" : "right"}
              >
                <div
                  className={`inspector-wrap ${settings ? "mobile-open" : ""}`}
                >
                  <div
                    className="pane-tabs"
                    role="tablist"
                    aria-label={t("Workspace pane")}
                  >
                    <button
                      role="tab"
                      aria-selected={activePane === "editor"}
                      className={activePane === "editor" ? "active" : ""}
                      onClick={() => setActivePane("editor")}
                    >
                      {t("Editor")}
                    </button>
                    <button
                      role="tab"
                      aria-selected={activePane === "animation"}
                      className={activePane === "animation" ? "active" : ""}
                      onClick={() => setActivePane("animation")}
                    >
                      {t("Animation")}
                    </button>
                  </div>
                  {activePane === "editor" ? (
                    <div
                      className="editor-pane"
                      inert={board.playbackTime !== null}
                    >
                      {fullscreen && <DrawingOptions />}
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
              </FullscreenPanel>
            </div>
          </>
        ) : (
          <div className="loading">
            {ready ? (
              <>
                <h1>{t("Your court is ready.")}</h1>
                <button
                  className="button primary"
                  onClick={() => setDialog({ type: "new" })}
                >
                  {t("Create a drill")}
                </button>
              </>
            ) : (
              t("Opening your local workspace…")
            )}
          </div>
        )}
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
      {explorer && (
        <LibraryExplorer
          folders={folders}
          projects={projects}
          current={folder}
          contents={contents}
          selected={project?.id}
          query={query}
          onQuery={setQuery}
          onFolder={selectFolder}
          onProject={(project) =>
            void run(async () => {
              await openProject(project);
              setExplorer(false);
            })
          }
          onManage={(folder) => setDialog({ type: "manage", folder })}
          onManageProject={(p) =>
            setDialog({ type: "details", projectId: p.id })
          }
          onNewFolder={() => setDialog({ type: "folder", fromExplorer: true })}
          onNewDrill={() => setDialog({ type: "new", fromExplorer: true })}
          onClose={() => setExplorer(false)}
          busy={busy}
          error={notice}
        />
      )}
      {dialog && (
        <Modal
          title={
            dialog.type === "new"
              ? t("Create a drill")
              : dialog.type === "folder"
                ? t("Create a folder")
                : dialog.type === "manage"
                  ? t("Manage folder")
                  : dialog.type === "details"
                    ? t("Drill details")
                    : dialog.type === "export"
                      ? t("Take your work with you")
                      : dialog.type === "preferences"
                        ? t("Workspace defaults")
                        : t("Your local workspace")
          }
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          {notice && (
            <p className="dialog-error" role="alert">
              {t(notice)}
            </p>
          )}
          {dialog.type === "preferences" && (
            <WorkspaceSettings onClose={() => setDialog(null)} />
          )}
          {isForm && (
            <form onSubmit={submit}>
              <label>
                {t("Name")}
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={
                    dialog.type === "manage"
                      ? dialog.folder.name
                      : dialog.type === "details"
                        ? detailsProject?.title
                        : ""
                  }
                  placeholder={
                    dialog.type === "new"
                      ? t("e.g. Creating space for the pivot")
                      : t("Give it a name")
                  }
                />
              </label>
              {parentSelect(
                dialog.type === "manage"
                  ? dialog.folder.parentId
                  : dialog.type === "details"
                    ? (detailsProject?.folderId ?? null)
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
                  <Copy size={14} /> {t("Duplicate folder and its drills")}
                </button>
              )}
              {dialog.type === "details" && (
                <>
                  <label>
                    {t("Tags")}
                    <input
                      name="tags"
                      defaultValue={detailsProject?.tags.join(", ")}
                      placeholder={t("U15, Pivot, Warmup")}
                    />
                  </label>
                  <label>
                    {t("Coaching notes")}
                    <textarea
                      name="description"
                      rows={4}
                      maxLength={10000}
                      defaultValue={detailsProject?.description}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || !detailsProject}
                    onClick={() =>
                      detailsProject &&
                      void run(async () => {
                        await duplicateDrill(detailsProject, false);
                        setDialog(null);
                      })
                    }
                  >
                    <Copy size={15} /> {t("Duplicate drill")}
                  </button>
                </>
              )}
              <div className="modal-actions">
                {dialog.type === "details" && (
                  <button
                    type="button"
                    className="text-button danger"
                    disabled={busy}
                    onClick={() =>
                      detailsProject &&
                      void run(() => deleteDrill(detailsProject))
                    }
                  >
                    <Trash2 size={14} /> {t("Delete drill")}
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
                          t("Delete “{v0}” and all its folders and drills?", {
                            v0: f.name,
                          }),
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
                    <Trash2 size={14} /> {t("Delete folder")}
                  </button>
                )}
                <button className="button primary" disabled={busy}>
                  {busy
                    ? t("Saving…")
                    : dialog.type === "new" || dialog.type === "folder"
                      ? t("Create")
                      : t("Save changes")}
                </button>
              </div>
            </form>
          )}
          {dialog.type === "export" && project && (
            <>
              <p className="muted">
                {t("Portable files, ready for your next training session.")}
              </p>
              <AnimatedExport
                project={project}
                assetUrls={urls}
                voronoi={board.voronoi}
              />
              <div className="export-options">
                <button
                  disabled={busy}
                  onClick={() => void run(() => exportProject(project))}
                >
                  <FilePlus2 />
                  <div>
                    <strong>
                      {t("Handball project")} <span>{t(".hbd")}</span>
                    </strong>
                    <small>
                      {t("Editable backup with every step and image")}
                    </small>
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
                      <strong>
                        {t("{v0} snapshot", { v0: format.toUpperCase() })}
                      </strong>
                      <small>
                        {format === "png"
                          ? t("A high-resolution image of this step")
                          : t("Scalable vector artwork with embedded images")}
                      </small>
                    </div>
                    <ArrowDownToLine size={17} />
                  </button>
                ))}
                <button
                  disabled={busy}
                  aria-label={t("Copy image to clipboard")}
                  onClick={() =>
                    void run(async () => {
                      setImageCopied(false);
                      setNotice(null);
                      await copySnapshotImage(
                        project.courtConfig.background === "floor"
                          ? project.courtConfig.themeColors.floor
                          : project.courtConfig.background,
                      );
                      setImageCopied(true);
                    })
                  }
                >
                  <Copy />
                  <div>
                    <strong>{t("Copy image to clipboard")}</strong>
                    <small>
                      {t("The same full-resolution image as the PNG snapshot")}
                    </small>
                  </div>
                  <Copy size={17} />
                </button>
              </div>
              {imageCopied && (
                <p className="muted" role="status">
                  {t("Image copied to clipboard.")}
                </p>
              )}
            </>
          )}
          {dialog.type === "help" && (
            <div className="help-content">
              <div className="help-about">
                <strong>
                  {t("Open Handball Tactics")} <span>{t("v0.2")}</span>
                </strong>
                <p>{t("Your ideas. Your court.")}</p>
                <p>
                  <ShieldCheck size={14} /> {t("Private by design")}
                </p>
              </div>
              <p>
                {t(
                  "Drills and images live in this browser on this device. After the first online visit, the tactics workspace works offline. In a live room, the shared drill, images, settings, and cursors go directly to the other coaches through encrypted peer connections.",
                )}
              </p>
              <p>
                {t(
                  "Use the tools to add players and equipment. Drag to move them, or choose an arrow tool and drag across the court. Drag an existing arrow to move the whole path; use its endpoints and numbered Bézier handles to reshape it. Double-click or double-tap an item to open its properties beside it. The popup includes Delete, number steppers, and all item settings, including arrowheads and bends. Drag the item or tap outside to close it. You can also select an item and press Enter on the court.",
                )}
              </p>
              <p>
                {t(
                  "Use Fullscreen to fill the screen with the court. Half courts have tools on the left and properties on the right; full courts have tools above and properties below. Hide either panel with its arrow and reopen it from the edge of the screen. Panels overlap the court without resizing it. Press Escape or the exit button to return to the workspace.",
                )}
              </p>
              <p>
                {t(
                  "Choose the pencil (B) to draw anywhere on the canvas. Pen options appear on the left, or in Properties in fullscreen. Right-click or drag to erase whole strokes, or choose the eraser (E) on a tablet. Clear drawing removes this step's drawings; Undo restores them. Pen only ignores fingers while you draw with a stylus.",
                )}
              </p>
              <p>
                {t(
                  "Rotate a selected object with its round handle or the angle input. Hold Shift while dragging the handle to snap to 15°. Use Add step to copy your positions, then move or rotate players in the new step. Play or scrub the timeline to preview their movement and rotation. Choose Edit step to resume editing.",
                )}
              </p>
              <p>
                {t(
                  "Voronoi mode, just left of Undo/Redo, shows the spaces closest to each player in their team's color. The goalkeeper counts with defense. Regions update as players move or animate.",
                )}
              </p>
              <p>
                {t(
                  "Workspace defaults in the top bar save your preferred court settings and player scale for new drills. The inspector edits this drill only. The sun/moon button changes the surrounding interface without changing your court colors.",
                )}
              </p>
              <p>
                {t("Export")} <strong>{t(".hbd")}</strong>{" "}
                {t(
                  "files as backups or to move drills to another browser. Clearing site data removes your local library.",
                )}
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
                <ShieldCheck size={15} /> {t("Request persistent storage")}
              </button>
              <p className="muted">
                {t(
                  "PNG, SVG, editable .hbd, animated GIF, and video exports are available. For WhatsApp Web, use WhatsApp MP4 and attach the video using Photos & videos. Copy image may paste a still preview; GIF animation support depends on the receiving app. PDF drill sheets are planned for a later release.",
                )}
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
