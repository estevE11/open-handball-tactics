import type { DrawingStroke, Point } from "../types/project";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

// Suppress tiny input jitter, then ease towards each sample. The final sample
// is kept exactly so the corrected line still ends where the user lifts the pen.
export function appendDrawingPoint(
  points: Point[],
  point: Point,
  smoothing: number,
  final = false,
) {
  if (points.length >= 10000) return;
  const last = points.at(-1);
  if (last && distance(last, point) < (final ? 0.01 : 0.6)) return;
  const alpha = final ? 1 : 1 - smoothing;
  points.push(
    last
      ? {
          x: last.x + (point.x - last.x) * alpha,
          y: last.y + (point.y - last.y) * alpha,
        }
      : point,
  );
}

// Midpoint quadratic curves keep adjoining tangents continuous instead of
// connecting mouse samples with visibly angular straight segments.
export function drawingPath(points: Point[]): string {
  if (!points.length) return "";
  const first = points[0];
  if (points.length === 1) return `M ${first.x} ${first.y} l 0 0`;
  let path = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const control = points[i - 1];
    const end = midpoint(control, points[i]);
    path += ` Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  const last = points.at(-1)!;
  return `${path} L ${last.x} ${last.y}`;
}

// Flatten the same curves used for rendering, so erasing follows the visible
// trace, including curves and dots. Sample more densely on longer sections.
export function drawingPolyline(points: Point[]): Point[] {
  if (!points.length) return [];
  const result = [points[0]];
  let start = points[0];
  for (let i = 1; i < points.length; i++) {
    const control = points[i - 1];
    const end = midpoint(control, points[i]);
    const steps = Math.max(
      1,
      Math.min(
        128,
        Math.ceil((distance(start, control) + distance(control, end)) / 2),
      ),
    );
    for (let step = 1; step <= steps; step++) {
      const t = step / steps,
        u = 1 - t;
      result.push({
        x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      });
    }
    start = end;
  }
  result.push(points.at(-1)!);
  return result;
}

function pointSegmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t =
    dx || dy
      ? Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
          ),
        )
      : 0;
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  if (
    cross(a, b, c) * cross(a, b, d) < 0 &&
    cross(c, d, a) * cross(c, d, b) < 0
  )
    return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

export function drawingHit(
  stroke: DrawingStroke,
  from: Point,
  to: Point,
  radius: number,
  polyline = drawingPolyline(stroke.points),
) {
  const tolerance = radius + stroke.width / 2;
  if (polyline.length === 1)
    return pointSegmentDistance(polyline[0], from, to) <= tolerance;
  return polyline.some(
    (p, i) =>
      i > 0 && segmentDistance(from, to, polyline[i - 1], p) <= tolerance,
  );
}
