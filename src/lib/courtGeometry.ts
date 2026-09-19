import type { DrillProject, Point } from "../types/project";

// View rotation leaves saved coordinates, ball offsets, and animation intact.
export function courtRotation(config: DrillProject["courtConfig"]) {
  if (config.type === "full") return -90;
  return config.type === "half" && config.halfCourtEnd === "bottom" ? 180 : 0;
}

export function courtSize(config: DrillProject["courtConfig"]) {
  const halfDepth = Number(config.halfCourtDepth ?? "20");
  return {
    width: config.type === "custom_box" ? config.dimensions.width * 20 : 400,
    height:
      config.type === "full"
        ? 800
        : config.type === "half"
          ? halfDepth * 20
          : config.dimensions.height * 20,
  };
}

export function fitPoint(
  point: Point,
  config: DrillProject["courtConfig"],
  padding = 0,
): Point {
  const { width, height } = courtSize(config);
  return {
    x: Math.max(padding, Math.min(width - padding, point.x)),
    y: Math.max(padding, Math.min(height - padding, point.y)),
  };
}

// Shrinking a court must not strand editable objects outside the visible area.
export function fitProjectToCourt(project: DrillProject) {
  for (const frame of project.keyframes) {
    for (const token of frame.tokens)
      token.position = fitPoint(
        token.position,
        project.courtConfig,
        token.size *
          (token.equipment === "ladder" ? 1.8 : 1) *
          (token.role === "equipment"
            ? 1
            : (project.courtConfig.playerScale ?? 1)),
      );
    for (const arrow of frame.arrows) {
      arrow.start = fitPoint(arrow.start, project.courtConfig);
      arrow.end = fitPoint(arrow.end, project.courtConfig);
      if (arrow.control)
        arrow.control = fitPoint(arrow.control, project.courtConfig);
      if (arrow.controlPoints)
        arrow.controlPoints = arrow.controlPoints.map((point) =>
          fitPoint(point, project.courtConfig),
        );
    }
  }
}
