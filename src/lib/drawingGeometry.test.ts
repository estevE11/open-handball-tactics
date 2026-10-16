import { expect, it } from "vitest";
import type { DrawingStroke, Point } from "../types/project";
import {
  appendDrawingPoint,
  drawingHit,
  drawingPath,
  drawingPolyline,
} from "./drawingGeometry";

const stroke = (points: Point[], width = 3): DrawingStroke => ({
  id: "ink",
  points,
  width,
  color: "#46564d",
  opacity: 1,
});

it("corrects jitter while preserving the exact start and pen-up endpoint", () => {
  const points = [{ x: 0, y: 0 }];
  appendDrawingPoint(points, { x: 0.1, y: 0.1 }, 0.5);
  expect(points).toHaveLength(1);
  appendDrawingPoint(points, { x: 10, y: 6 }, 0.5);
  expect(points[1]).toEqual({ x: 5, y: 3 });
  appendDrawingPoint(points, { x: 20, y: 0 }, 0.5, true);
  expect(points.at(-1)).toEqual({ x: 20, y: 0 });
  expect(drawingPath(points)).toContain(" Q ");
  expect(drawingPath(points)).toMatch(/^M 0 0 .* L 20 0$/);
});

it("can reduce correction without dropping input or exceeding saved point limits", () => {
  const points = [{ x: 0, y: 0 }];
  appendDrawingPoint(points, { x: 10, y: 6 }, 0);
  expect(points[1]).toEqual({ x: 10, y: 6 });
  const full = Array.from({ length: 10000 }, () => ({ x: 0, y: 0 }));
  appendDrawingPoint(full, { x: 100, y: 100 }, 0);
  expect(full).toHaveLength(10000);
});

it("erases a whole trace when a fast sweep crosses between pointer samples", () => {
  const trace = stroke([
    { x: 50, y: 0 },
    { x: 50, y: 100 },
  ]);
  expect(drawingHit(trace, { x: 0, y: 50 }, { x: 100, y: 50 }, 2)).toBe(true);
  expect(drawingHit(trace, { x: 0, y: 110 }, { x: 100, y: 110 }, 2)).toBe(
    false,
  );
});

it("hits the corrected curve rather than its control polygon", () => {
  const trace = stroke(
    [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 },
    ],
    1,
  );
  const visible = { x: 100, y: 75 };
  expect(drawingHit(trace, visible, visible, 1)).toBe(true);
  const rawCorner = { x: 100, y: 100 };
  expect(drawingHit(trace, rawCorner, rawCorner, 1)).toBe(false);
});

it("handles dots, thick strokes, and collinear eraser sweeps", () => {
  const dot = stroke([{ x: 20, y: 20 }], 12);
  expect(drawingHit(dot, { x: 27, y: 20 }, { x: 27, y: 20 }, 1)).toBe(true);
  expect(drawingHit(dot, { x: 28, y: 20 }, { x: 28, y: 20 }, 1)).toBe(false);
  const line = stroke([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]);
  expect(drawingHit(line, { x: 20, y: 0 }, { x: 30, y: 0 }, 0)).toBe(true);
  expect(drawingHit(line, { x: 110, y: 0 }, { x: 120, y: 0 }, 0)).toBe(false);
  expect(
    drawingPolyline([
      { x: 0, y: 0 },
      { x: 1e300, y: 1e300 },
    ]).length,
  ).toBeLessThan(132);
});
