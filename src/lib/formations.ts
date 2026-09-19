import type { TacticalToken } from "../types/project";

export type Defense = "6:0" | "5:1" | "3:2:1" | "4:2" | "3:3";
export type Offense = "3:3" | "2:4";
export const defenses: Defense[] = ["6:0", "5:1", "3:2:1", "4:2", "3:3"];
export const offenses: Offense[] = ["3:3", "2:4"];
// Coordinates are court units (20 units/m), with the defended goal at the top.
const defensePositions: Record<Defense, [number, number, string][]> = {
  "6:0": [
    [42, 80, "1"],
    [91, 128, "2"],
    [159, 146, "3"],
    [241, 146, "3"],
    [309, 128, "2"],
    [358, 80, "1"],
  ],
  "5:1": [
    [42, 80, "1"],
    [94, 130, "2"],
    [200, 145, "3"],
    [306, 130, "2"],
    [358, 80, "1"],
    [200, 211, "Av"],
  ],
  "3:2:1": [
    [58, 94, "1"],
    [200, 143, "3"],
    [342, 94, "1"],
    [114, 190, "2"],
    [286, 190, "2"],
    [200, 242, "Av"],
  ],
  "4:2": [
    [48, 89, "1"],
    [151, 141, "3"],
    [249, 141, "3"],
    [352, 89, "1"],
    [128, 208, "Av"],
    [272, 208, "Av"],
  ],
  "3:3": [
    [58, 94, "1"],
    [200, 143, "3"],
    [342, 94, "1"],
    [95, 208, "Av"],
    [200, 232, "Av"],
    [305, 208, "Av"],
  ],
};
// Offense: F/E/D = left wing/pivot/right wing; A/B/C = left/center/right back.
// In 2:4, B advances to a second pivot alongside E.
export function formation(
  role: "defender" | "attacker",
  system: Defense | Offense,
): TacticalToken[] {
  const positions: [number, number, string][] =
    role === "defender"
      ? defensePositions[system as Defense]
      : system === "2:4"
        ? [
            [28, 122, "F"],
            [125, 265, "A"],
            [275, 265, "C"],
            [372, 122, "D"],
            [154, 171, "B"],
            [246, 171, "E"],
          ]
        : [
            [28, 122, "F"],
            [101, 256, "A"],
            [200, 289, "B"],
            [299, 256, "C"],
            [372, 122, "D"],
            [238, 174, "E"],
          ];
  return positions.map(([x, y, label]) => ({
    id: crypto.randomUUID(),
    role,
    shape: role === "defender" ? "triangle" : "circle",
    label,
    color: role === "defender" ? "#eaa958" : "#4f8cba",
    size: 14,
    rotation: role === "defender" ? 180 : 0,
    position: { x, y },
  }));
}
