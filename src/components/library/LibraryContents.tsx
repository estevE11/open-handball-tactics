import { useTranslation } from "../../lib/i18n";
import { Folder, MoreHorizontal } from "lucide-react";
import type { LibraryContents as Contents } from "../../lib/libraryNavigation";
import type { DrillProject, FolderNode } from "../../types/project";

export function LibraryContents({
  contents,
  selected,
  onFolder,
  onProject,
  onManage,
  onManageProject,
  query,
  view = "list",
  busy = false,
}: {
  contents: Contents;
  selected?: string;
  onFolder: (id: string) => void;
  onProject: (project: DrillProject) => void;
  onManage: (folder: FolderNode) => void;
  onManageProject: (project: DrillProject) => void;
  query: string;
  view?: "list" | "grid";
  busy?: boolean;
}) {
  const t = useTranslation();
  return (
    <ul
      className={`library-contents library-view-${view}`}
      aria-label={t("Folder contents")}
    >
      {contents.folders.map((folder) => {
        const count = folder.childrenFolderIds.length + folder.drillIds.length;
        return (
          <li className="library-folder" key={folder.id}>
            <button
              className="folder-open"
              aria-label={t("Open folder {v0}", { v0: folder.name })}
              disabled={busy}
              onClick={() => onFolder(folder.id)}
            >
              <span className="folder-glyph">
                <Folder size={29} />
              </span>
              <span className="drill-card-info">
                <strong title={folder.name}>{folder.name}</strong>
                <span>
                  {t("Folder ·")} {count} {count === 1 ? t("item") : t("items")}
                </span>
              </span>
            </button>
            <button
              className="icon-button folder-manage"
              aria-label={t("Manage {v0}", { v0: folder.name })}
              disabled={busy}
              onClick={() => onManage(folder)}
            >
              <MoreHorizontal size={15} />
            </button>
          </li>
        );
      })}
      {contents.projects.map((project) => (
        <li className="library-drill" key={project.id}>
          <button
            className={`drill-card ${project.id === selected ? "active" : ""}`}
            disabled={busy}
            onClick={() => onProject(project)}
            aria-current={project.id === selected ? "true" : undefined}
          >
            <span className="mini-court" aria-hidden="true">
              <span />
              <i />
              <b />
            </span>
            <span className="drill-card-info">
              <strong title={project.title}>{project.title}</strong>
              <span>
                {project.tags[0] || t("Handball drill")} ·{" "}
                {project.keyframes.length}{" "}
                {project.keyframes.length === 1 ? t("step") : t("steps")}
              </span>
            </span>
          </button>
          <button
            className="icon-button drill-manage"
            aria-label={t("Manage drill {v0}", { v0: project.title })}
            title={t("Manage {v0}", { v0: project.title })}
            disabled={busy}
            onClick={() => onManageProject(project)}
          >
            <MoreHorizontal size={17} />
          </button>
        </li>
      ))}
      {!contents.folders.length && !contents.projects.length && (
        <li className="empty-library">
          {query.trim()
            ? t("No folders or drills match your search.")
            : t("A fresh space for your next idea.")}
        </li>
      )}
    </ul>
  );
}
