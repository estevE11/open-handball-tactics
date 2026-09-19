import type { DrillProject, TacticalToken } from "../types/project";

export function tokenRotation(token: TacticalToken) {
  return (
    token.rotation ??
    (token.role === "defender" || token.role === "goalkeeper" ? 180 : 0)
  );
}

// Additive compatibility: legacy drills had no orientation and square goalkeepers.
// An explicit rotation marks a token created/edited with the new model.
export function normalizeProject(source: DrillProject): DrillProject {
  const project = structuredClone(source);
  for (const frame of project.keyframes)
    for (const token of frame.tokens) {
      if (token.rotation === undefined && token.role === "goalkeeper")
        token.shape = "triangle";
      token.rotation = tokenRotation(token);
    }
  return project;
}
