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
  const [view, setView] = useState<"list" | "grid">("grid");
  const [treeOpen, setTreeOpen] = useState(false);
  function selectFolder(id: string | null) {
    onFolder(id);
    setTreeOpen(false);
  }
  return (
    <Modal
      title="Library explorer"
      className="library-explorer"
      onClose={onClose}
      headingActions={
        <>
          <button
            className="button secondary explorer-create"
            aria-label="New folder"
            title="New folder in this location"
            disabled={busy}
            onClick={onNewFolder}
          >
            <FolderPlus size={17} />
            <span>New folder</span>
          </button>
          <button
            className="button primary explorer-create"
            aria-label="New drill"
            title="New drill in this location"
            disabled={busy}
            onClick={onNewDrill}
          >
            <FilePlus2 size={17} />
            <span>New drill</span>
          </button>
        </>
      }
    >
      <div className="explorer-toolbar">
        <button
          className="icon-button explorer-tree-toggle"
          aria-label="Toggle folder tree"
          aria-expanded={treeOpen}
          aria-controls="explorer-folder-tree"
          onClick={() => setTreeOpen(!treeOpen)}
        >
          <PanelLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Parent folder"
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
            aria-label="Close folder tree"
            onClick={() => setTreeOpen(false)}
          />
        )}
        <aside
          id="explorer-folder-tree"
          className={`explorer-tree ${treeOpen ? "is-open" : ""}`}
          aria-label="Library folder tree"
        >
          <FolderTree
            folders={folders}
            projects={projects}
            active={current}
            onSelect={selectFolder}
            onManage={onManage}
          />
        </aside>
        <section className="explorer-main" aria-label="Library contents">
          <div className="explorer-controls">
            <label className="search">
              <Search size={15} />
              <input
                aria-label="Search library"
                placeholder="Search folders, drills, tags…"
                value={query}
                onChange={(event) => onQuery(event.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="Clear library search"
                  onClick={() => onQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div
              className="explorer-view-switch"
              role="group"
              aria-label="Library view"
            >
              <button
                className="icon-button"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={17} />
              </button>
            </div>
          </div>
          {error && (
            <p className="dialog-error" role="alert">
              {error}
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
            {contents.folders.length === 1 ? "folder" : "folders"} ·{" "}
            {contents.projects.length}{" "}
            {contents.projects.length === 1 ? "drill" : "drills"}
          </footer>
        </section>
      </div>
    </Modal>
  );
}
