import type { DrillProject, FolderNode } from "../types/project";

export function folderAncestors(
  folders: FolderNode[],
  id: string | null,
): FolderNode[] {
  const path: FolderNode[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folders.find((item) => item.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

export function folderPath(folders: FolderNode[], id: string | null) {
  return folderAncestors(folders, id)
    .map((folder) => folder.name)
    .join(" / ");
}

export function libraryContents(
  folders: FolderNode[],
  projects: DrillProject[],
  current: string | null,
  search: string,
) {
  const query = search.trim().toLocaleLowerCase();
  return {
    folders: folders
      .filter(
        (folder) =>
          folder.parentId === current &&
          folder.name.toLocaleLowerCase().includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
    // All drills is the existing aggregate view; individual folders show only
    // their own drills. Folder contents never include descendant folders.
    projects: projects.filter(
      (project) =>
        (current === null || project.folderId === current) &&
        `${project.title} ${project.tags.join(" ")} ${folderPath(folders, project.folderId)}`
          .toLocaleLowerCase()
          .includes(query),
    ),
  };
}

export type LibraryContents = ReturnType<typeof libraryContents>;
