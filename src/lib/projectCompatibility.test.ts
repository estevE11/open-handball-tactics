import { expect, it } from "vitest";
import { normalizeProject } from "./projectCompatibility";
import { DEFAULT_COURT, newProject } from "./projectDefaults";
import { projectSchema } from "../types/project";

it("moves legacy court arms to individual players without overriding explicit choices", () => {
  const project = newProject();
  project.courtConfig.showArms = true;
  project.keyframes[0].tokens[0].arms = false;
  const normalized = normalizeProject(projectSchema.parse(project));
  expect(normalized.courtConfig.showArms).toBeUndefined();
  expect(normalized.keyframes[0].tokens[0].arms).toBe(false);
  for (const token of normalized.keyframes[0].tokens.slice(1))
    expect(token.arms).toBe(token.role === "equipment" ? undefined : true);
  expect(normalizeProject(normalized)).toEqual(normalized);
  expect(project.courtConfig.showArms).toBe(true);
});

it("keeps arms off by default, including with legacy workspace defaults", () => {
  for (const court of [DEFAULT_COURT, { ...DEFAULT_COURT, showArms: true }]) {
    const project = normalizeProject(newProject("New", null, court));
    expect(project.courtConfig.showArms).toBeUndefined();
    expect(project.keyframes[0].tokens.some((token) => token.arms)).toBe(false);
  }
});
