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
