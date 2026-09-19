import type { DrillProject, Point } from "../types/project";

export function courtSize(config: DrillProject["courtConfig"]) {
  return {
    width: config.type === "custom_box" ? config.dimensions.width * 20 : 400,
    height:
      config.type === "full"
        ? 800
        : config.type === "half"
          ? 400
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
        token.size,
      );
    for (const arrow of frame.arrows) {
      arrow.start = fitPoint(arrow.start, project.courtConfig);
      arrow.end = fitPoint(arrow.end, project.courtConfig);
      if (arrow.control)
        arrow.control = fitPoint(arrow.control, project.courtConfig);
    }
  }
}
