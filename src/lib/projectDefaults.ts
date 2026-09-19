import type { DrillProject, CourtConfig } from "../types/project";
import { formation } from "./formations";
import { fitProjectToCourt, courtSize } from "./courtGeometry";

export const DEFAULT_COURT: CourtConfig = {
  type: "half",
  halfCourtDepth: "20",
  dimensions: { width: 20, height: 20 },
  background: "floor",
  themeColors: { floor: "#e5eee9", area: "#c9ddd5", lines: "#ffffff" },
  lineWeight: 2,
  grid: false,
  showLabels: true,
  highlight: false,
  playerScale: 1,
};

export function newProject(
  title = "Untitled drill",
  folderId: string | null = null,
  courtConfig: CourtConfig = DEFAULT_COURT,
): DrillProject {
  const project: DrillProject = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    description: "",
    courtConfig: structuredClone(courtConfig),
    customAssets: [],
    keyframes: [
      {
        id: crypto.randomUUID(),
        name: "Starting positions",
        duration: 1500,
        tokens: [
          ...formation("defender", "6:0"),
          ...formation("attacker", "3:3"),
          {
            id: crypto.randomUUID(),
            role: "goalkeeper",
            shape: "triangle",
            rotation: 180,
            label: "GK",
            color: "#879a85",
            size: 13,
            position: { x: 200, y: 25 },
          },
          {
            id: crypto.randomUUID(),
            role: "equipment",
            shape: "circle",
            label: "",
            color: "#f6f1e7",
            size: 6,
            position: { x: 220, y: 305 },
            equipment: "ball",
          },
        ],
        arrows: [],
      },
    ],
  };
  if (courtConfig.type === "custom_box") {
    const { width, height } = courtSize(courtConfig);
    for (const token of project.keyframes[0].tokens)
      token.position = {
        x: (token.position.x * width) / 400,
        y: (token.position.y * height) / 400,
      };
  }
  fitProjectToCourt(project);
  return project;
}
