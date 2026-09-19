import { expect, it } from "vitest";
import { formation } from "./formations";
import { tokenLabelAngle } from "./tokenLabels";
import { sampleProject } from "./animation";
import { newProject } from "./projectDefaults";

it("keeps default and reversed defenders readable without losing manual tilt", () => {
  const defender = formation("defender", "5:1")[5];
  expect(tokenLabelAngle(defender)).toBe(0);
  expect(tokenLabelAngle({ ...defender, rotation: 0 })).toBe(0);
  expect(tokenLabelAngle({ ...defender, rotation: 150 })).toBe(-30);
  expect(tokenLabelAngle({ ...defender, rotation: 210 })).toBe(30);
  expect(tokenLabelAngle({ ...defender, role: "goalkeeper" })).toBe(0);
});

it("keeps letters readable across full rotations and shortest-arc animation", () => {
  const attacker = formation("attacker", "3:3")[0];
  expect(tokenLabelAngle(attacker)).toBe(0);
  expect(tokenLabelAngle({ ...attacker, rotation: 135 })).toBe(-45);
  for (let rotation = -720; rotation <= 720; rotation += 5) {
    expect(
      Math.abs(tokenLabelAngle({ ...attacker, rotation })),
    ).toBeLessThanOrEqual(90);
  }
  const project = newProject();
  project.keyframes[0].tokens[0].rotation = 350;
  const next = structuredClone(project.keyframes[0]);
  next.tokens[0].rotation = 10;
  project.keyframes.push(next);
  expect(tokenLabelAngle(sampleProject(project, 0).frame.tokens[0])).toBe(-10);
  expect(tokenLabelAngle(sampleProject(project, 750).frame.tokens[0])).toBe(0);
  expect(tokenLabelAngle(sampleProject(project, 1500).frame.tokens[0])).toBe(
    10,
  );
});
