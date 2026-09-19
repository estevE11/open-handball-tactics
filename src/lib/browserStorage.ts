import Dexie, { type Table } from "dexie";
import type { PlayerKit } from "../types/kit";
import { normalizeProject } from "./projectCompatibility";
import {
  projectSchema,
  type DrillProject,
  type FolderNode,
  type StoredAsset,
} from "../types/project";

export class BoardDatabase extends Dexie {
  projects!: Table<DrillProject, string>;
  kits!: Table<PlayerKit, string>;
  folders!: Table<FolderNode, string>;
  assets!: Table<StoredAsset, string>;
  constructor(name = "ohb.library.v1") {
    super(name);
    this.version(1).stores({
      projects: "id, folderId, updatedAt, *tags",
      folders: "id, parentId",
      assets: "id, createdAt",
    });
    this.version(2).stores({ kits: "id, name" });
  }
}
export const db = new BoardDatabase();

export class LibraryService {
  constructor(readonly database = db) {}
  private async requireFolder(id: string | null) {
    if (id && !(await this.database.folders.get(id)))
      throw new Error("The destination folder no longer exists.");
  }
  private async syncTree() {
    const [folders, drills] = await Promise.all([
      this.database.folders.toArray(),
      this.database.projects.toArray(),
    ]);
    await this.database.folders.bulkPut(
      folders.map((f) => ({
        ...f,
        childrenFolderIds: folders
          .filter((c) => c.parentId === f.id)
          .map((c) => c.id),
        drillIds: drills.filter((p) => p.folderId === f.id).map((p) => p.id),
      })),
    );
  }
  async save(project: DrillProject) {
    const valid = normalizeProject(projectSchema.parse(project));
    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.folders,
      async () => {
        await this.requireFolder(valid.folderId);
        const previous = await this.database.projects.get(valid.id);
        await this.database.projects.put({ ...valid, updatedAt: Date.now() });
        // Editing a drill does not change folder membership. Avoid rebuilding
        // the complete tree for every drag, label, or color update.
        if (!previous || previous.folderId !== valid.folderId)
          await this.syncTree();
      },
    );
  }
  async createFolder(name: string, parentId: string | null) {
    if (!name.trim()) throw new Error("Give the folder a name.");
    const folder: FolderNode = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 160),
      parentId,
      childrenFolderIds: [],
      drillIds: [],
    };
    await this.database.transaction(
      "rw",
      this.database.folders,
      this.database.projects,
      async () => {
        await this.requireFolder(parentId);
        await this.database.folders.add(folder);
        await this.syncTree();
      },
    );
    return folder;
  }
  async updateFolder(id: string, name: string, parentId: string | null) {
    await this.database.transaction(
      "rw",
      this.database.folders,
      this.database.projects,
      async () => {
        const folder = await this.database.folders.get(id);
        if (!folder || !name.trim())
          throw new Error("A folder and name are required.");
        await this.requireFolder(parentId);
        let ancestor = parentId;
        const seen = new Set([id]);
        while (ancestor) {
          if (seen.has(ancestor))
            throw new Error("A folder cannot be moved inside itself.");
          seen.add(ancestor);
          ancestor =
            (await this.database.folders.get(ancestor))?.parentId ?? null;
        }
        await this.database.folders.put({
          ...folder,
          name: name.trim().slice(0, 160),
          parentId,
        });
        await this.syncTree();
      },
    );
  }
  async duplicate(project: DrillProject) {
    const copy = {
      ...structuredClone(project),
      id: crypto.randomUUID(),
      title: `${project.title.slice(0, 150)} (copy)`,
      createdAt: Date.now(),
    };
    await this.save(copy);
    return copy;
  }
  async duplicateFolder(id: string) {
    return this.database.transaction(
      "rw",
      this.database.projects,
      this.database.folders,
      async () => {
        const source = await this.database.folders.get(id);
        if (!source) throw new Error("This folder no longer exists.");
        const folders = await this.database.folders.toArray();
        const projects = await this.database.projects.toArray();
        const copyBranch = async (
          folder: FolderNode,
          parentId: string | null,
          root = false,
        ): Promise<FolderNode> => {
          const copy = await this.createFolder(
            root ? `${folder.name.slice(0, 150)} (copy)` : folder.name,
            parentId,
          );
          for (const p of projects.filter((p) => p.folderId === folder.id)) {
            await this.save({
              ...structuredClone(p),
              id: crypto.randomUUID(),
              folderId: copy.id,
              createdAt: Date.now(),
            });
          }
          for (const child of folders.filter((f) => f.parentId === folder.id))
            await copyBranch(child, copy.id);
          return copy;
        };
        return copyBranch(source, source.parentId, true);
      },
    );
  }
  private async pruneAssets() {
    const projects = await this.database.projects.toArray();
    const used = new Set(
      projects.flatMap((p) => p.customAssets.map((a) => a.id)),
    );
    // Uploaded library assets remain reusable; only explicit deletion removes them.
    return used;
  }
  async deleteProject(id: string) {
    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.folders,
      async () => {
        await this.database.projects.delete(id);
        await this.syncTree();
      },
    );
  }
  async deleteFolder(id: string) {
    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.folders,
      async () => {
        const folders = await this.database.folders.toArray();
        const deleting = new Set([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of folders)
            if (f.parentId && deleting.has(f.parentId) && !deleting.has(f.id)) {
              deleting.add(f.id);
              changed = true;
            }
        }
        const projects = await this.database.projects.toArray();
        await this.database.projects.bulkDelete(
          projects
            .filter((p) => p.folderId && deleting.has(p.folderId))
            .map((p) => p.id),
        );
        await this.database.folders.bulkDelete([...deleting]);
        await this.syncTree();
      },
    );
  }
  async uploadAsset(file: Blob & { name?: string }) {
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    )
      throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Images must be smaller than 10 MB.");
    const asset: StoredAsset = {
      id: crypto.randomUUID(),
      name: file.name ?? "Image",
      blob: file,
      createdAt: Date.now(),
    };
    await this.database.assets.add(asset);
    return asset;
  }
  async deleteAsset(id: string) {
    await this.database.transaction(
      "rw",
      this.database.assets,
      this.database.projects,
      async () => {
        if ((await this.pruneAssets()).has(id))
          throw new Error(
            "This image is used in a drill. Remove its image tokens before deleting it.",
          );
        await this.database.assets.delete(id);
      },
    );
  }
}
export const library = new LibraryService();
