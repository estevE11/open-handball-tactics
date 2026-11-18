import { useTranslation } from "../../lib/i18n";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  LayoutGrid,
  MoreHorizontal,
} from "lucide-react";
import { folderAncestors } from "../../lib/libraryNavigation";
import type { FolderNode } from "../../types/project";

export function FolderPath({
  folders,
  current,
  onSelect,
  onManage,
  horizontal = false,
}: {
  folders: FolderNode[];
  current: string | null;
  onSelect: (id: string | null) => void;
  onManage?: (folder: FolderNode) => void;
  horizontal?: boolean;
}) {
  const t = useTranslation();
  return (
    <nav
      className={`folder-path ${horizontal ? "horizontal" : ""}`}
      aria-label={t("Current folder path")}
    >
      <ol>
        <li>
          <button
            className={`path-link ${current === null ? "active" : ""}`}
            onClick={() => onSelect(null)}
            aria-current={current === null ? "location" : undefined}
          >
            <LayoutGrid size={16} />
            <span>{t("All drills")}</span>
          </button>
        </li>
        {folderAncestors(folders, current).map((folder, index) => (
          <li
            key={folder.id}
            style={!horizontal ? { paddingLeft: (index + 1) * 12 } : undefined}
          >
            <ChevronRight size={12} aria-hidden="true" />
            <button
              className={`path-link ${current === folder.id ? "active" : ""}`}
              title={folder.name}
              onClick={() => onSelect(folder.id)}
              aria-current={current === folder.id ? "location" : undefined}
            >
              {current === folder.id ? (
                <FolderOpen size={16} />
              ) : (
                <Folder size={16} />
              )}
              <span>{folder.name}</span>
            </button>
            {onManage && (
              <button
                className="icon-button folder-manage"
                aria-label={t("Manage {v0}", { v0: folder.name })}
                onClick={() => onManage(folder)}
              >
                <MoreHorizontal size={14} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
