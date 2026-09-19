import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const kitSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  pattern: z.enum(["solid", "stripes", "halves"]),
  direction: z.enum(["vertical", "horizontal", "diagonal", "reverse_diagonal"]),
  stripeCount: z.number().int().min(1).max(3),
  primary: color,
  secondary: color,
  labelColor: color,
});
export type PlayerKit = z.infer<typeof kitSchema>;
export type KitRole = "attacker" | "defender";
