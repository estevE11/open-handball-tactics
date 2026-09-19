import { z } from "zod";

const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const tokenSchema = z.object({
  id: z.string(),
  role: z.enum(["attacker", "defender", "goalkeeper", "equipment"]),
  shape: z.enum(["triangle", "circle", "square"]),
  label: z.string().max(80),
  color,
  size: z.number().min(2).max(100),
  rotation: z.number().finite().optional(),
  position: point,
  equipment: z
    .enum(["ball", "cone", "goal", "ladder", "text", "image"])
    .optional(),
  assetId: z.string().optional(),
});
export const arrowSchema = z.object({
  id: z.string(),
  type: z.enum(["run", "pass", "dribble", "screen"]),
  start: point,
  end: point,
  control: point.optional(),
  controlPoints: z.array(point).max(12).optional(),
  heads: z.enum(["end", "start", "both", "none"]).optional(),
  color,
});
export const courtConfigSchema = z.object({
  type: z.enum(["full", "half", "custom_box"]),
  halfCourtEnd: z.enum(["top", "bottom"]).optional(),
  dimensions: z.object({
    width: z.number().min(10).max(100),
    height: z.number().min(10).max(100),
  }),
  themeColors: z.object({ floor: color, area: color, lines: color }),
  playerScale: z.number().min(0.5).max(2).optional(),
  lineWeight: z.number().min(1).max(5),
  grid: z.boolean(),
  showLabels: z.boolean(),
  highlight: z.boolean(),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string().min(1).max(160),
  folderId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  tags: z.array(z.string().max(80)).max(50),
  description: z.string().max(10000).optional(),
  courtConfig: courtConfigSchema,
  customAssets: z.array(
    z.object({ id: z.string(), name: z.string(), blobUri: z.string() }),
  ),
  keyframes: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        duration: z.number().min(100).max(30000),
        tokens: z.array(tokenSchema).max(500),
        arrows: z.array(arrowSchema).max(500),
      }),
    )
    .min(1)
    .max(200),
});
export type Point = z.infer<typeof point>;
export type TacticalToken = z.infer<typeof tokenSchema>;
export type TacticalArrow = z.infer<typeof arrowSchema>;
export type DrillProject = z.infer<typeof projectSchema>;
export type Keyframe = DrillProject["keyframes"][number];
export interface FolderNode {
  id: string;
  parentId: string | null;
  name: string;
  childrenFolderIds: string[];
  drillIds: string[];
}
export interface StoredAsset {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}
export type Tool =
  | "select"
  | TacticalArrow["type"]
  | "attacker"
  | "defender"
  | "goalkeeper"
  | "ball"
  | "cone"
  | "goal"
  | "ladder"
  | "text";

export type CourtConfig = z.infer<typeof courtConfigSchema>;
