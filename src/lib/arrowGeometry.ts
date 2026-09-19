import type { Point, TacticalArrow } from "../types/project";

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
export const arrowControls = (arrow: TacticalArrow): Point[] =>
  arrow.controlPoints ?? (arrow.control ? [arrow.control] : []);
export const editableControls = (arrow: TacticalArrow) =>
  arrowControls(arrow).length
    ? arrowControls(arrow)
    : [midpoint(arrow.start, arrow.end)];
export function withControls(
  arrow: TacticalArrow,
  points: Point[],
): TacticalArrow {
  const next = { ...arrow, controlPoints: points };
  delete next.control;
  return next;
}
export function addControl(arrow: TacticalArrow): TacticalArrow {
  const controls = editableControls(arrow);
  if (controls.length >= 12) return arrow;
  // Splitting the first quadratic preserves its exact shape while adding a handle.
  if (controls.length === 1)
    return withControls(arrow, [
      midpoint(arrow.start, controls[0]),
      midpoint(controls[0], arrow.end),
    ]);
  return withControls(arrow, [
    ...controls,
    midpoint(controls.at(-1)!, arrow.end),
  ]);
}
export function translateArrow(
  arrow: TacticalArrow,
  delta: Point,
  bounds: { width: number; height: number },
): TacticalArrow {
  const all = [arrow.start, ...arrowControls(arrow), arrow.end];
  const dx = Math.max(
    -Math.min(...all.map((p) => p.x)),
    Math.min(bounds.width - Math.max(...all.map((p) => p.x)), delta.x),
  );
  const dy = Math.max(
    -Math.min(...all.map((p) => p.y)),
    Math.min(bounds.height - Math.max(...all.map((p) => p.y)), delta.y),
  );
  const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
  return withControls(
    { ...arrow, start: move(arrow.start), end: move(arrow.end) },
    arrowControls(arrow).map(move),
  );
}
export function arrowSegments(arrow: TacticalArrow) {
  const controls = editableControls(arrow);
  return controls.map((control, index) => ({
    start: index === 0 ? arrow.start : midpoint(controls[index - 1], control),
    control,
    end:
      index === controls.length - 1
        ? arrow.end
        : midpoint(control, controls[index + 1]),
  }));
}
export function arrowPath(arrow: TacticalArrow) {
  const segments = arrowSegments(arrow);
  if (arrow.type !== "dribble")
    return (
      `M${arrow.start.x} ${arrow.start.y} ` +
      (arrowControls(arrow).length
        ? segments
            .map((s) => `Q${s.control.x} ${s.control.y} ${s.end.x} ${s.end.y}`)
            .join(" ")
        : `L${arrow.end.x} ${arrow.end.y}`)
    );
  const samples: { point: Point; normal: Point; distance: number }[] = [];
  const count = Math.max(80, segments.length * 24);
  for (let i = 0; i <= count; i++) {
    const progress = (i / count) * segments.length;
    const index = Math.min(segments.length - 1, Math.floor(progress));
    const t = progress - index,
      u = 1 - t;
    const { start: s, control: c, end: e } = segments[index];
    const point = {
      x: u * u * s.x + 2 * u * t * c.x + t * t * e.x,
      y: u * u * s.y + 2 * u * t * c.y + t * t * e.y,
    };
    const dx = 2 * u * (c.x - s.x) + 2 * t * (e.x - c.x),
      dy = 2 * u * (c.y - s.y) + 2 * t * (e.y - c.y);
    const length = Math.hypot(dx, dy) || 1;
    const previous = samples.at(-1);
    samples.push({
      point,
      normal: { x: -dy / length, y: dx / length },
      distance: previous
        ? previous.distance +
          Math.hypot(point.x - previous.point.x, point.y - previous.point.y)
        : 0,
    });
  }
  const length = samples.at(-1)!.distance || 1;
  const waves = Math.max(2, Math.round(length / 22));
  return samples
    .map(({ point, normal, distance }, i) => {
      const offset = Math.sin((distance / length) * Math.PI * 2 * waves) * 3;
      return `${i ? "L" : "M"}${point.x + normal.x * offset} ${point.y + normal.y * offset}`;
    })
    .join(" ");
}
export function arrowEndAngles(arrow: TacticalArrow) {
  const controls = arrowControls(arrow);
  const first =
    [...controls, arrow.end].find(
      (p) => Math.hypot(p.x - arrow.start.x, p.y - arrow.start.y) > 0.01,
    ) ?? arrow.end;
  const last =
    [...controls]
      .reverse()
      .concat(arrow.start)
      .find((p) => Math.hypot(p.x - arrow.end.x, p.y - arrow.end.y) > 0.01) ??
    arrow.start;
  return {
    start:
      (Math.atan2(arrow.start.y - first.y, arrow.start.x - first.x) * 180) /
      Math.PI,
    end:
      (Math.atan2(arrow.end.y - last.y, arrow.end.x - last.x) * 180) / Math.PI,
  };
}
