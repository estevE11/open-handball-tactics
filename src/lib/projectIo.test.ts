import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { db } from "./browserStorage";
import { importProject } from "./projectIo";
import { newProject } from "./projectDefaults";

afterEach(async () => {
  await db.projects.clear();
  await db.folders.clear();
  await db.assets.clear();
});
const backup = (
  project: ReturnType<typeof newProject>,
  assets: unknown[] = [],
) =>
  new File(
    [
      JSON.stringify({
        format: "open-handball-board",
        version: 1,
        project,
        assets,
      }),
    ],
    "drill.hbd",
    { type: "application/json" },
  );
it("imports into a new identity and remaps all embedded image references", async () => {
  const project = newProject();
  project.customAssets = [
    { id: "original-image", name: "Logo", blobUri: "asset:original-image" },
  ];
  project.keyframes[0].tokens.push({
    id: "image-token",
    role: "equipment",
    equipment: "image",
    assetId: "original-image",
    shape: "square",
    label: "Logo",
    size: 20,
    position: { x: 100, y: 200 },
    color: "#ffffff",
  });
  const result = await importProject(
    backup(project, [
      {
        id: "original-image",
        name: "Logo",
        data: "data:image/png;base64,aW1hZ2U=",
      },
    ]),
    null,
  );
  expect(result.id).not.toBe(project.id);
  expect(result.customAssets[0].id).not.toBe("original-image");
  expect(result.keyframes[0].tokens.at(-1)?.assetId).toBe(
    result.customAssets[0].id,
  );
  expect(
    await (await db.assets.get(result.customAssets[0].id))?.blob.text(),
  ).toBe("image");
});
it("rejects malformed or incomplete projects without partial writes", async () => {
  const project = newProject();
  project.customAssets.push({
    id: "missing",
    name: "Logo",
    blobUri: "asset:missing",
  });
  await expect(importProject(backup(project), null)).rejects.toThrow(
    "missing an embedded image",
  );
  await expect(
    importProject(new File(["{}"], "bad.hbd"), null),
  ).rejects.toThrow();
  expect(await db.projects.count()).toBe(0);
  expect(await db.assets.count()).toBe(0);
});
it("rolls back imported blobs if the destination folder does not exist", async () => {
  const project = newProject();
  await expect(
    importProject(
      backup(project, [
        { id: "image", name: "Logo", data: "data:image/png;base64,aW1hZ2U=" },
      ]),
      "missing-folder",
    ),
  ).rejects.toThrow("no longer exists");
  expect(await db.assets.count()).toBe(0);
  expect(await db.projects.count()).toBe(0);
});
