import { expect, it } from "vitest";
import { newProject } from "./projectDefaults";
import { courtSize, courtViewBox, fitProjectToCourt } from "./courtGeometry";

it("supports a compact 20 × 16 m half court", () => {
  const project = newProject();
  expect(courtSize(project.courtConfig)).toEqual({ width: 400, height: 400 });
  project.courtConfig.halfCourtDepth = "16";
  project.courtConfig.dimensions.height = 16;
  expect(courtSize(project.courtConfig)).toEqual({ width: 400, height: 320 });
  expect(courtViewBox(project.courtConfig)).toBe("-12 -16 424 352");
  project.courtConfig.halfCourtEnd = "bottom";
  expect(courtViewBox(project.courtConfig)).toBe("-12 64 424 352");
});

it("keeps all steps and curved arrows editable after shrinking the court", () => {
  const project = newProject();
  project.keyframes.push(structuredClone(project.keyframes[0]));
  project.keyframes[1].arrows.push({
    id: "path",
    type: "run",
    start: { x: 350, y: 750 },
    end: { x: 300, y: 650 },
    control: { x: 390, y: 799 },
    color: "#000000",
  });
  project.courtConfig.type = "custom_box";
  project.courtConfig.dimensions = { width: 10, height: 10 };
  fitProjectToCourt(project);
  for (const frame of project.keyframes)
    for (const token of frame.tokens) {
      expect(token.position.x).toBeLessThanOrEqual(200 - token.size);
      expect(token.position.y).toBeLessThanOrEqual(200 - token.size);
    }
  expect(project.keyframes[1].arrows[0].control).toEqual({ x: 200, y: 200 });
});
