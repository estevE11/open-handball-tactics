import { expect, it } from "vitest";
import { newProject } from "./projectDefaults";
import { animationExportPlan } from "./animationExportPlan";

it("retains transition timing, exact final positions, and a final pause", () => {
  const project = newProject();
  project.keyframes[0].duration = 1500;
  project.keyframes.push({
    ...structuredClone(project.keyframes[0]),
    id: "next",
  });
  const before = structuredClone(project);
  const plan = animationExportPlan(project);
  expect(plan.frames).toHaveLength(31);
  expect(plan.frames[0]).toEqual({ time: 0, delay: 50 });
  expect(plan.frames.at(-1)).toEqual({ time: 1500, delay: 1000 });
  expect(plan.frames.reduce((sum, frame) => sum + frame.delay, 0)).toBe(2500);
  expect(Math.max(plan.width, plan.height)).toBe(720);
  expect(project).toEqual(before);
});

it("keeps single-step export valid and bounds work for the longest supported drills", () => {
  const project = newProject();
  expect(animationExportPlan(project).frames).toEqual([
    { time: 0, delay: 1000 },
  ]);
  project.keyframes = Array.from({ length: 200 }, (_, i) => ({
    ...structuredClone(project.keyframes[0]),
    id: String(i),
    duration: 30000,
  }));
  const plan = animationExportPlan(project);
  expect(plan.frames.length).toBeLessThanOrEqual(1201);
  expect(plan.frames.at(-1)!.time).toBe(199 * 30000);
  expect(plan.frames.reduce((sum, f) => sum + f.delay, 0)).toBe(plan.duration);
});

it("uses stable bounds around off-court drawings in every step and orientation", () => {
  const project = newProject();
  project.keyframes.push({
    ...structuredClone(project.keyframes[0]),
    id: "next",
    drawings: [
      {
        id: "outside",
        color: "#ff0000",
        width: 6,
        opacity: 1,
        points: [
          { x: -100, y: -200 },
          { x: 900, y: 1000 },
        ],
      },
    ],
  });
  for (const view of ["top", "bottom", "full"] as const) {
    project.courtConfig.type = view === "full" ? "full" : "half";
    project.courtConfig.halfCourtEnd = view === "bottom" ? "bottom" : "top";
    const { bounds, width, height } = animationExportPlan(project);
    const points =
      view === "full"
        ? [
            { x: -200, y: 500 },
            { x: 1000, y: -500 },
          ]
        : view === "bottom"
          ? [
              { x: 500, y: 600 },
              { x: -500, y: -600 },
            ]
          : [
              { x: -100, y: -200 },
              { x: 900, y: 1000 },
            ];
    for (const p of points) {
      expect(p.x).toBeGreaterThan(bounds.x);
      expect(p.y).toBeGreaterThan(bounds.y);
      expect(p.x).toBeLessThan(bounds.x + bounds.width);
      expect(p.y).toBeLessThan(bounds.y + bounds.height);
    }
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  }
});
