import { z } from "zod";

export const petoSchema = z.object({
  enabled: z.boolean(),
  color: z.enum(["yellow", "orange", "green", "blue"]),
});
export const PETO_COLORS = {
  yellow: { label: "Yellow", color: "#facc15" },
  orange: { label: "Orange", color: "#fb923c" },
  green: { label: "Green", color: "#4ade80" },
  blue: { label: "Blue", color: "#60a5fa" },
} as const;
