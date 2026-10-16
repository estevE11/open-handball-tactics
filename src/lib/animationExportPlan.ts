import type { DrillProject, Point } from "../types/project";
import { animationDuration } from "./animation";
import { courtRotation, courtViewBox } from "./courtGeometry";

export function animationExportPlan(project: DrillProject) {
  const duration = animationDuration(project);
  // Keep long drills bounded in memory while retaining their full timing.
  const interval = Math.max(50, Math.ceil(duration / 1200 / 10) * 10);
  const frames: { time: number; delay: number }[] = [];
  for (let time = 0; time < duration; time += interval)
    frames.push({ time, delay: Math.min(interval, duration - time) });
  frames.push({ time: duration, delay: 1000 });
  const [x, y, width, height] = courtViewBox(project.courtConfig)
    .split(" ")
    .map(Number);
  let left = x,
    top = y,
    right = x + width,
    bottom = y + height;
  const rotation = courtRotation(project.courtConfig);
  const rotate = (p: Point): Point =>
    rotation === -90
      ? { x: p.y, y: 400 - p.x }
      : rotation === 180
        ? { x: 400 - p.x, y: 400 - p.y }
        : p;
  // One stable viewport for all steps keeps off-court ink visible without
  // changing scale or cropping as drawings appear/disappear during playback.
  for (const frame of project.keyframes)
    for (const stroke of frame.drawings ?? [])
      for (const point of stroke.points) {
        const p = rotate(point),
          padding = stroke.width / 2 + 4;
        left = Math.min(left, p.x - padding);
        top = Math.min(top, p.y - padding);
        right = Math.max(right, p.x + padding);
        bottom = Math.max(bottom, p.y + padding);
      }
  const bounds = { x: left, y: top, width: right - left, height: bottom - top };
  const scale = 720 / Math.max(bounds.width, bounds.height);
  return {
    frames,
    duration: duration + 1000,
    bounds,
    width: Math.max(2, Math.round((bounds.width * scale) / 2) * 2),
    height: Math.max(2, Math.round((bounds.height * scale) / 2) * 2),
  };
}
