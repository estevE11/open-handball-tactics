import { kitSchema, type PlayerKit, type KitRole } from "../types/kit";
import type { DrillProject, TacticalToken } from "../types/project";
import { db, type BoardDatabase } from "./browserStorage";

export const kitDirections = {
  vertical: "Vertical",
  horizontal: "Horizontal",
  diagonal: "Diagonal",
  reverse_diagonal: "Reverse diagonal",
} as const;
export function newKit(): PlayerKit {
  return {
    id: crypto.randomUUID(),
    name: "",
    pattern: "stripes",
    direction: "vertical",
    stripeCount: 2,
    primary: "#245b9b",
    secondary: "#ffffff",
    labelColor: "#ffffff",
  };
}
const base = {
  pattern: "solid",
  direction: "vertical",
  stripeCount: 1,
  primary: "#245b9b",
  secondary: "#ffffff",
  labelColor: "#ffffff",
} as const;
export const BASIC_KITS: PlayerKit[] = [
  { ...base, id: "basic-solid", name: "Solid color" },
  ...Object.entries(kitDirections).flatMap(([direction, label]) => [
    ...[1, 2, 3].map((stripeCount) => ({
      ...base,
      id: `basic-${direction}-${stripeCount}`,
      name: `${label} · ${stripeCount} ${stripeCount === 1 ? "stripe" : "stripes"}`,
      pattern: "stripes" as const,
      direction: direction as PlayerKit["direction"],
      stripeCount,
    })),
    {
      ...base,
      id: `basic-${direction}-halves`,
      name: `${label} halves`,
      pattern: "halves" as const,
      direction: direction as PlayerKit["direction"],
    },
  ]),
];
export class KitLibrary {
  constructor(readonly database: BoardDatabase = db) {}
  list() {
    return this.database.kits.orderBy("name").toArray();
  }
  async save(kit: PlayerKit) {
    const valid = kitSchema.parse(kit);
    if (valid.id.startsWith("basic-"))
      throw new Error("Save a basic kit as a new design.");
    await this.database.kits.put(valid);
    return valid;
  }
}
export const kitLibrary = new KitLibrary();

export function playerKit(project: DrillProject, token: TacticalToken) {
  return token.role === "attacker" || token.role === "defender"
    ? project.teamKits?.[token.role]
    : undefined;
}
export function applyKit(
  project: DrillProject,
  role: KitRole,
  kit?: PlayerKit,
) {
  project.teamKits ??= {};
  if (kit) project.teamKits[role] = structuredClone(kit);
  else delete project.teamKits[role];
}
