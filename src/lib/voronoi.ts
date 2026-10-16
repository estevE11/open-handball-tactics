import type { Point, TacticalToken } from "../types/project";

export interface VoronoiCell {
  id: string;
  team: "attacker" | "defender";
  points: Point[];
}

// Clip a convex polygon to the side of a perpendicular bisector containing
// the player. Starting with the court rectangle keeps every cell on court.
function clip(polygon: Point[], site: Point, other: Point): Point[] {
  const dx = other.x - site.x,
    dy = other.y - site.y;
  const length = Math.hypot(dx, dy);
  const nx = dx / length,
    ny = dy / length;
  const mx = (site.x + other.x) / 2,
    my = (site.y + other.y) / 2;
  const distance = (p: Point) => (p.x - mx) * nx + (p.y - my) * ny;
  const result: Point[] = [];
  let previous = polygon.at(-1)!;
  let previousDistance = distance(previous);
  for (const current of polygon) {
    const currentDistance = distance(current);
    const previousInside = previousDistance <= 0;
    const currentInside = currentDistance <= 0;
    if (previousInside !== currentInside) {
      const t = previousDistance / (previousDistance - currentDistance);
      result.push({
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
      });
    }
    if (currentInside) result.push(current);
    previous = current;
    previousDistance = currentDistance;
  }
  return result;
}

export function voronoiCells(
  tokens: TacticalToken[],
  { width, height }: { width: number; height: number },
): VoronoiCell[] {
  // Coincident players share a site. Stable first-player ownership avoids
  // overlapping fills (which would incorrectly increase the 0.3 opacity).
  const sites = tokens.filter(
    (token, index) =>
      token.role !== "equipment" &&
      !tokens
        .slice(0, index)
        .some(
          (other) =>
            other.role !== "equipment" &&
            Math.hypot(
              other.position.x - token.position.x,
              other.position.y - token.position.y,
            ) < 1e-7,
        ),
  );
  return sites.flatMap((site) => {
    let points = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
    for (const other of sites) {
      if (site === other) continue;
      points = clip(points, site.position, other.position);
      if (points.length < 3) return [];
    }
    return [
      {
        id: site.id,
        team: site.role === "attacker" ? "attacker" : "defender",
        points,
      },
    ];
  });
}
