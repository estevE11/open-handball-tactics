import type { TacticalToken } from "../types/project";
import { tokenRotation } from "./projectCompatibility";

// Keep a chip's manual tilt, with upright defaults and no upside-down lettering.
// This is a screen angle; the renderer compensates for the court's view rotation.
export function tokenLabelAngle(token: TacticalToken) {
  const facing =
    token.role === "defender" || token.role === "goalkeeper" ? 180 : 0;
  const angle =
    ((((tokenRotation(token) - facing + 180) % 360) + 360) % 360) - 180;
  return angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
}

export function labelOutline(color: string) {
  const r = parseInt(color.slice(1, 3), 16),
    g = parseInt(color.slice(3, 5), 16),
    b = parseInt(color.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#18212a" : "#ffffff";
}
