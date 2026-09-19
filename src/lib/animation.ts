import type { DrillProject, Keyframe, Point } from "../types/project";
import { tokenRotation } from "./projectCompatibility";

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixPoint = (a: Point, b: Point, t: number): Point => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
});
export function mixRotation(from: number, to: number, t: number) {
  const delta = ((((to - from + 540) % 360) + 360) % 360) - 180;
  return from + delta * t;
}
export const frameTime = (project: DrillProject, index: number) =>
  project.keyframes
    .slice(0, index)
    .reduce((sum, frame) => sum + frame.duration, 0);
export const animationDuration = (project: DrillProject) =>
  frameTime(project, project.keyframes.length - 1);

export function sampleProject(
  project: DrillProject,
  time: number,
): { frame: Keyframe; index: number } {
  let index = 0;
  let remaining = Math.max(0, time);
  while (
    index < project.keyframes.length - 1 &&
    remaining >= project.keyframes[index].duration
  ) {
    remaining -= project.keyframes[index].duration;
    index++;
  }
  const from = project.keyframes[index];
  const to = project.keyframes[index + 1];
  if (!to) return { frame: from, index };
  const t = remaining / from.duration;
  const tokens = new Map(to.tokens.map((token) => [token.id, token]));
  const arrows = new Map(to.arrows.map((arrow) => [arrow.id, arrow]));
  return {
    index,
    frame: {
      ...from,
      tokens: from.tokens.map((token) => {
        const next = tokens.get(token.id);
        return next
          ? {
              ...token,
              position: mixPoint(token.position, next.position, t),
              size: mix(token.size, next.size, t),
              rotation: mixRotation(
                tokenRotation(token),
                tokenRotation(next),
                t,
              ),
            }
          : token;
      }),
      arrows: from.arrows.map((arrow) => {
        const next = arrows.get(arrow.id);
        if (!next) return arrow;
        const control = arrow.control ?? mixPoint(arrow.start, arrow.end, 0.5);
        const nextControl = next.control ?? mixPoint(next.start, next.end, 0.5);
        return {
          ...arrow,
          start: mixPoint(arrow.start, next.start, t),
          end: mixPoint(arrow.end, next.end, t),
          control:
            arrow.control || next.control
              ? mixPoint(control, nextControl, t)
              : undefined,
        };
      }),
    },
  };
}
