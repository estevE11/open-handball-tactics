import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { BoardDatabase, LibraryService } from "./browserStorage";
import { KitLibrary, applyKit, newKit, playerKit } from "./kits";
import { newProject } from "./projectDefaults";
import { projectSchema } from "../types/project";

it("upgrades an existing library without losing drills, folders, or assets", async () => {
  const name = `kits-upgrade-${crypto.randomUUID()}`;
  const legacy = new Dexie(name);
  legacy
    .version(1)
    .stores({
      projects: "id, folderId, updatedAt, *tags",
      folders: "id, parentId",
      assets: "id, createdAt",
    });
  const project = newProject();
  await legacy.table("projects").put(project);
  await legacy
    .table("folders")
    .put({
      id: "folder",
      parentId: null,
      name: "Defense",
      childrenFolderIds: [],
      drillIds: [],
    });
  await legacy
    .table("assets")
    .put({ id: "image", name: "Logo", blob: new Blob(["logo"]), createdAt: 1 });
  legacy.close();
  const upgraded = new BoardDatabase(name);
  try {
    const kits = new KitLibrary(upgraded);
    await kits.save({ ...newKit(), name: "Home" });
    expect(await upgraded.projects.get(project.id)).toEqual(project);
    expect(await upgraded.folders.count()).toBe(1);
    expect(await (await upgraded.assets.get("image"))?.blob.text()).toBe(
      "logo",
    );
    upgraded.close();
    await upgraded.open();
    expect((await kits.list())[0].name).toBe("Home");
  } finally {
    await upgraded.delete();
  }
});

it("embeds independent kits in projects and preserves them through serialization and duplication", async () => {
  const database = new BoardDatabase(`kits-${crypto.randomUUID()}`);
  try {
    const kits = new KitLibrary(database);
    const kit = await kits.save({
      ...newKit(),
      name: "Home",
      pattern: "halves",
      direction: "diagonal",
    });
    const project = newProject();
    applyKit(project, "attacker", kit);
    await kits.save({ ...kit, name: "Away", primary: "#ff0000" });
    expect(project.teamKits?.attacker?.name).toBe("Home");
    const library = new LibraryService(database);
    await library.save(project);
    const copy = await library.duplicate(
      projectSchema.parse(JSON.parse(JSON.stringify(project))),
    );
    expect(copy.teamKits).toEqual(project.teamKits);
    const attacker = copy.keyframes[0].tokens.find(
      (t) => t.role === "attacker",
    )!;
    expect(playerKit(copy, attacker)?.primary).toBe(kit.primary);
    expect(playerKit(copy, copy.keyframes[0].tokens[0])).toBeUndefined();
    applyKit(copy, "attacker");
    expect(playerKit(copy, attacker)).toBeUndefined();
    expect(project.teamKits?.attacker).toBeDefined();
    await expect(kits.save({ ...kit, name: "  " })).rejects.toThrow();
  } finally {
    await database.delete();
  }
});
