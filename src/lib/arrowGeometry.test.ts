import { expect, it } from "vitest";
import type { TacticalArrow } from "../types/project";
import {
  addControl,
  arrowControls,
  arrowPath,
  arrowSegments,
  translateArrow,
  arrowEndAngles,
} from "./arrowGeometry";

const base: TacticalArrow = {
  id: "arrow",
  type: "run",
  color: "#000000",
  start: { x: 40, y: 80 },
  end: { x: 200, y: 120 },
  control: { x: 100, y: 30 },
};
it("moves both endpoints and every control point together, including legacy arrows", () => {
  const moved = translateArrow(
    base,
    { x: 20, y: 10 },
    { width: 400, height: 400 },
  );
  expect(moved.start).toEqual({ x: 60, y: 90 });
  expect(moved.end).toEqual({ x: 220, y: 130 });
  expect(arrowControls(moved)).toEqual([{ x: 120, y: 40 }]);
  const bounded = translateArrow(
    base,
    { x: -200, y: -200 },
    { width: 400, height: 400 },
  );
  expect(bounded.start).toEqual({ x: 0, y: 50 });
  expect(arrowControls(bounded)[0].y).toBe(0);
  expect(base.control).toEqual({ x: 100, y: 30 });
});
it("splits a quadratic without changing its curve, then supports multiple handles", () => {
  const split = addControl(base);
  expect(arrowControls(split)).toEqual([
    { x: 70, y: 55 },
    { x: 150, y: 75 },
  ]);
  expect(arrowSegments(split)[0].end).toEqual({ x: 110, y: 65 });
  let many = split;
  for (let i = 0; i < 20; i++) many = addControl(many);
  expect(arrowControls(many)).toHaveLength(12);
  expect(arrowPath(many).match(/Q/g)).toHaveLength(12);
});
it("renders curved dribbles and degenerate paths without invalid coordinates", () => {
  const dribble = arrowPath({ ...addControl(base), type: "dribble" });
  expect(dribble.startsWith("M40 80")).toBe(true);
  expect(dribble).not.toMatch(/NaN|Infinity/);
  expect(
    arrowPath({ ...base, type: "dribble", start: base.end, control: base.end }),
  ).not.toMatch(/NaN|Infinity/);
  expect(arrowEndAngles({ ...base, control: base.end }).end).toBeCloseTo(
    (Math.atan2(40, 160) * 180) / Math.PI,
  );
});
