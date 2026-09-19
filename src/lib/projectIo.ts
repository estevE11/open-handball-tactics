import { z } from "zod";
import { db, library } from "./browserStorage";
import { projectSchema, type DrillProject } from "../types/project";

const fileSchema = z.object({
  format: z.literal("open-handball-board"),
  version: z.literal(1),
  project: projectSchema,
  assets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        data: z.string().max(15_000_000),
      }),
    )
    .max(100),
});
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(blob);
  });
}
export async function exportProject(project: DrillProject) {
  const assets = await Promise.all(
    project.customAssets.map(async (ref) => {
      const asset = await db.assets.get(ref.id);
      if (!asset) throw new Error(`Missing image: ${ref.name}`);
      return {
        id: asset.id,
        name: asset.name,
        data: await dataUrl(asset.blob),
      };
    }),
  );
  download(
    new Blob(
      [
        JSON.stringify(
          { format: "open-handball-board", version: 1, project, assets },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    `${project.title}.hbd`,
  );
}
export async function importProject(file: File, folderId: string | null) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Project files must be smaller than 100 MB.");
  const parsed = fileSchema.parse(JSON.parse(await file.text()));
  const mapping = new Map<string, string>();
  const assets = parsed.assets.map((a) => {
    if (mapping.has(a.id)) throw new Error("Duplicate asset identifiers.");
    const match =
      /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
        a.data,
      );
    if (!match) throw new Error("Invalid embedded image.");
    const id = crypto.randomUUID();
    mapping.set(a.id, id);
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (bytes.length > 10 * 1024 * 1024)
      throw new Error("An embedded image exceeds 10 MB.");
    return {
      id,
      name: a.name,
      blob: new Blob([bytes], { type: match[1] }),
      createdAt: Date.now(),
    };
  });
  const project: DrillProject = {
    ...parsed.project,
    id: crypto.randomUUID(),
    folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    customAssets: parsed.project.customAssets.map((a) => {
      const id = mapping.get(a.id);
      if (!id) throw new Error("The project is missing an embedded image.");
      return { ...a, id, blobUri: `asset:${id}` };
    }),
    keyframes: parsed.project.keyframes.map((f) => ({
      ...f,
      tokens: f.tokens.map((t) => {
        if (t.assetId && !mapping.has(t.assetId))
          throw new Error("A token references a missing image.");
        return {
          ...t,
          assetId: t.assetId ? mapping.get(t.assetId) : undefined,
        };
      }),
    })),
  };
  await db.transaction("rw", db.projects, db.folders, db.assets, async () => {
    await db.assets.bulkAdd(assets);
    await library.save(project);
  });
  return project;
}
