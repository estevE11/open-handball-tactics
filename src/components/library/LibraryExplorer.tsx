import { useTranslation } from "../../lib/i18n";
import { useState } from "react";
import {
  ArrowUp,
  FilePlus2,
  FolderPlus,
  LayoutGrid,
  List,
  PanelLeft,
  Search,
  X,
} from "lucide-react";
import type { LibraryContents as Contents } from "../../lib/libraryNavigation";
import type { DrillProject, FolderNode } from "../../types/project";
import { Modal } from "../ui/Modal";
import { FolderTree } from "./FolderTree";
import { FolderPath } from "./FolderPath";
import { LibraryContents } from "./LibraryContents";

export function LibraryExplorer({
  folders,
  projects,
  current,
  contents,
  selected,
  query,
  onQuery,
  onFolder,
  onProject,
  onManage,
  onManageProject,
  onNewFolder,
  onNewDrill,
  onClose,
  busy,
  error,
}: {
  folders: FolderNode[];
  projects: DrillProject[];
  current: string | null;
  contents: Contents;
  selected?: string;
  query: string;
  onQuery: (query: string) => void;
  onFolder: (id: string | null) => void;
  onProject: (project: DrillProject) => void;
  onManage: (folder: FolderNode) => void;
  onManageProject: (project: DrillProject) => void;
  onNewFolder: () => void;
  onNewDrill: () => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
}) {
  const t = useTranslation();
  const [view, setView] = useState<"list" | "grid">("grid");
  const [treeOpen, setTreeOpen] = useState(false);
  function selectFolder(id: string | null) {
    onFolder(id);
    setTreeOpen(false);
  }
  return (
    <Modal
      title={t("Library explorer")}
      className="library-explorer"
      onClose={onClose}
      headingActions={
        <>
          <button
            className="button secondary explorer-create"
            aria-label={t("New folder")}
            title={t("New folder in this location")}
            disabled={busy}
            onClick={onNewFolder}
          >
            <FolderPlus size={17} />
            <span>{t("New folder")}</span>
          </button>
          <button
            className="button primary explorer-create"
            aria-label={t("New drill")}
            title={t("New drill in this location")}
            disabled={busy}
            onClick={onNewDrill}
          >
            <FilePlus2 size={17} />
            <span>{t("New drill")}</span>
          </button>
        </>
      }
    >
      <div className="explorer-toolbar">
        <button
          className="icon-button explorer-tree-toggle"
          aria-label={t("Toggle folder tree")}
          aria-expanded={treeOpen}
          aria-controls="explorer-folder-tree"
          onClick={() => setTreeOpen(!treeOpen)}
        >
          <PanelLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label={t("Parent folder")}
          disabled={!current || busy}
          onClick={() =>
            selectFolder(
              folders.find((folder) => folder.id === current)?.parentId ?? null,
            )
          }
        >
          <ArrowUp size={18} />
        </button>
        <FolderPath
          folders={folders}
          current={current}
          onSelect={selectFolder}
          horizontal
        />
      </div>
      <div className="explorer-body">
        {treeOpen && (
          <button
            className="explorer-tree-scrim"
            aria-label={t("Close folder tree")}
            onClick={() => setTreeOpen(false)}
          />
        )}
        <aside
          id="explorer-folder-tree"
          className={`explorer-tree ${treeOpen ? "is-open" : ""}`}
          aria-label={t("Library folder tree")}
        >
          <FolderTree
            folders={folders}
            projects={projects}
            active={current}
            onSelect={selectFolder}
            onManage={onManage}
          />
        </aside>
        <section className="explorer-main" aria-label={t("Library contents")}>
          <div className="explorer-controls">
            <label className="search">
              <Search size={15} />
              <input
                aria-label={t("Search library")}
                placeholder={t("Search folders, drills, tags…")}
                value={query}
                onChange={(event) => onQuery(event.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label={t("Clear library search")}
                  onClick={() => onQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div
              className="explorer-view-switch"
              role="group"
              aria-label={t("Library view")}
            >
              <button
                className="icon-button"
                aria-label={t("List view")}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={t("Grid view")}
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={17} />
              </button>
            </div>
          </div>
          {error && (
            <p className="dialog-error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="explorer-files">
            <LibraryContents
              contents={contents}
              selected={selected}
              onFolder={selectFolder}
              onProject={onProject}
              onManage={onManage}
              onManageProject={onManageProject}
              query={query}
              view={view}
              busy={busy}
            />
          </div>
          <footer className="explorer-footer">
            {contents.folders.length}{" "}
            {contents.folders.length === 1 ? t("folder") : t("folders")} ·{" "}
            {contents.projects.length}{" "}
            {contents.projects.length === 1 ? t("drill") : t("drills")}
          </footer>
        </section>
      </div>
    </Modal>
  );
}
