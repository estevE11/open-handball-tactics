import { expect, it } from "vitest";
import { newProject } from "./projectDefaults";
import { animationDuration, mixRotation, sampleProject } from "./animation";
import { normalizeProject } from "./projectCompatibility";

it("animates position and rotation along the shortest arc without mutating frames", () => {
  const project = newProject();
  const first = project.keyframes[0];
  first.tokens[0].rotation = 350;
  first.tokens[0].position = { x: 40, y: 80 };
  const second = structuredClone(first);
  second.id = "next";
  second.tokens[0].rotation = 10;
  second.tokens[0].position = { x: 140, y: 180 };
  project.keyframes.push(second);
  const before = structuredClone(project);
  const halfway = sampleProject(project, 750).frame.tokens[0];
  expect(halfway.rotation).toBe(360);
  expect(halfway.position).toEqual({ x: 90, y: 130 });
  expect(
    sampleProject(project, animationDuration(project)).frame.tokens[0].rotation,
  ).toBe(10);
  expect(project).toEqual(before);
  expect(mixRotation(10, 350, 0.5)).toBe(0);
});

it("restores legacy orientations and triangle goalkeepers while keeping explicit edits", () => {
  const project = newProject();
  const keeper = project.keyframes[0].tokens.find(
    (t) => t.role === "goalkeeper",
  )!;
  keeper.shape = "square";
  delete keeper.rotation;
  delete project.keyframes[0].tokens[0].rotation;
  const migrated = normalizeProject(project);
  expect(
    migrated.keyframes[0].tokens.find((t) => t.role === "goalkeeper"),
  ).toMatchObject({ shape: "triangle", rotation: 180 });
  expect(migrated.keyframes[0].tokens[0].rotation).toBe(180);
  keeper.rotation = 0;
  expect(
    normalizeProject(project).keyframes[0].tokens.find(
      (t) => t.role === "goalkeeper",
    ),
  ).toMatchObject({ shape: "square", rotation: 0 });
});

it("handles one step and clamps animation to the last frame", () => {
  const project = newProject();
  expect(animationDuration(project)).toBe(0);
  expect(sampleProject(project, 10000).frame).toEqual(project.keyframes[0]);
});
