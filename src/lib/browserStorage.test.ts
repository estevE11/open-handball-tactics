import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardDatabase, LibraryService } from "./browserStorage";
import { newProject } from "./projectDefaults";

let database: BoardDatabase;
let service: LibraryService;
beforeEach(() => {
  database = new BoardDatabase(`test-${crypto.randomUUID()}`);
  service = new LibraryService(database);
});
afterEach(async () => {
  await database.delete();
});
describe("local library integrity", () => {
  it("persists projects and synchronizes folder membership when moved", async () => {
    const folder = await service.createFolder("Defense", null);
    const project = newProject("6:0", folder.id);
    await service.save(project);
    expect((await database.folders.get(folder.id))?.drillIds).toEqual([
      project.id,
    ]);
    await service.save({ ...project, folderId: null });
    expect((await database.folders.get(folder.id))?.drillIds).toEqual([]);
    expect(
      (await database.projects.get(project.id))?.keyframes[0].tokens,
    ).toHaveLength(14);
  });
  it("rejects cycles and leaves the tree unchanged", async () => {
    const parent = await service.createFolder("Parent", null);
    const child = await service.createFolder("Child", parent.id);
    await expect(
      service.updateFolder(parent.id, "Parent", child.id),
    ).rejects.toThrow("inside itself");
    expect((await database.folders.get(parent.id))?.parentId).toBeNull();
  });
  it("deletes nested folders and their drills without deleting unrelated drills", async () => {
    const parent = await service.createFolder("Parent", null);
    const child = await service.createFolder("Child", parent.id);
    await service.save(newProject("Nested", child.id));
    const keep = newProject("Keep");
    await service.save(keep);
    await service.deleteFolder(parent.id);
    expect(await database.folders.count()).toBe(0);
    expect((await database.projects.toArray()).map((p) => p.id)).toEqual([
      keep.id,
    ]);
  });
  it("duplicates independently and retains binary images across database reopen", async () => {
    const asset = await service.uploadAsset(
      new Blob(["image-data"], { type: "image/png" }),
    );
    const project = newProject();
    project.customAssets.push({
      id: asset.id,
      name: asset.name,
      blobUri: `asset:${asset.id}`,
    });
    await service.save(project);
    const copy = await service.duplicate(project);
    await service.deleteProject(project.id);
    database.close();
    await database.open();
    expect(await (await database.assets.get(asset.id))?.blob.text()).toBe(
      "image-data",
    );
    expect((await database.projects.get(copy.id))?.customAssets[0].id).toBe(
      asset.id,
    );
    await expect(service.deleteAsset(asset.id)).rejects.toThrow(
      "used in a drill",
    );
  });
  it("rejects stale destinations atomically", async () => {
    const p = newProject("Invalid", "missing");
    await expect(service.save(p)).rejects.toThrow("no longer exists");
    expect(await database.projects.count()).toBe(0);
  });
  it("validates upload types and size", async () => {
    await expect(
      service.uploadAsset(new Blob(["x"], { type: "text/html" })),
    ).rejects.toThrow("Choose a PNG");
    await expect(
      service.uploadAsset(
        new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "image/png" }),
      ),
    ).rejects.toThrow("smaller than");
  });
  it("rolls back a project write when updating its folder membership fails", async () => {
    const folder = await service.createFolder("Defense", null);
    const project = newProject("Rollback", folder.id);
    const fault = vi
      .spyOn(database.folders, "bulkPut")
      .mockRejectedValueOnce(new Error("Simulated storage failure"));
    await expect(service.save(project)).rejects.toThrow(
      "Simulated storage failure",
    );
    fault.mockRestore();
    expect(await database.projects.get(project.id)).toBeUndefined();
    expect((await database.folders.get(folder.id))?.drillIds).toEqual([]);
  });
  it("duplicates complete folder subtrees with independent identifiers", async () => {
    const parent = await service.createFolder("Offense", null);
    const child = await service.createFolder("Fastbreaks", parent.id);
    const original = newProject("Wing", child.id);
    await service.save(original);
    const copy = await service.duplicateFolder(parent.id);
    const copies = (await database.folders.toArray()).filter(
      (f) => f.parentId === copy.id,
    );
    expect(copies).toHaveLength(1);
    expect(copies[0].id).not.toBe(child.id);
    const copiedDrills = (await database.projects.toArray()).filter(
      (p) => p.folderId === copies[0].id,
    );
    expect(copiedDrills[0].id).not.toBe(original.id);
    await service.deleteFolder(parent.id);
    expect((await database.projects.toArray()).map((p) => p.title)).toEqual([
      "Wing",
    ]);
  });
});
