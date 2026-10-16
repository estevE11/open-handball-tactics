import { expect, it } from "vitest";
import type { Point, TacticalToken } from "../types/project";
import { voronoiCells } from "./voronoi";
import { newProject } from "./projectDefaults";

const player = (
  id: string,
  x: number,
  y: number,
  role: TacticalToken["role"] = "attacker",
): TacticalToken => ({
  id,
  role,
  position: { x, y },
  color: "#000000",
  size: 14,
  shape: "circle",
  label: id,
});
const area = (points: Point[]) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p.x * next.y - next.x * p.y;
    }, 0),
  ) / 2;
const bounds = { width: 400, height: 400 };

it("splits two players' regions at their perpendicular bisector", () => {
  const cells = voronoiCells(
    [player("A", 100, 200), player("D", 300, 200, "defender")],
    bounds,
  );
  expect(cells).toHaveLength(2);
  expect(cells[0].team).toBe("attacker");
  expect(cells[1].team).toBe("defender");
  expect(area(cells[0].points)).toBe(80000);
  expect(area(cells[1].points)).toBe(80000);
  expect(cells[0].points.every((p) => p.x <= 200)).toBe(true);
  expect(cells[1].points.every((p) => p.x >= 200)).toBe(true);
});

it("partitions the entire court into nearest-player regions, including the defending goalkeeper", () => {
  const tokens = newProject().keyframes[0].tokens;
  const original = structuredClone(tokens);
  for (const height of [320, 400, 800]) {
    const cells = voronoiCells(tokens, { width: 400, height });
    expect(cells).toHaveLength(13);
    expect(cells.reduce((sum, cell) => sum + area(cell.points), 0)).toBeCloseTo(
      400 * height,
      5,
    );
    for (const cell of cells) {
      const site = tokens.find((token) => token.id === cell.id)!;
      if (site.role === "goalkeeper") expect(cell.team).toBe("defender");
      for (const p of cell.points) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-7);
        expect(p.x).toBeLessThanOrEqual(400 + 1e-7);
        expect(p.y).toBeGreaterThanOrEqual(-1e-7);
        expect(p.y).toBeLessThanOrEqual(height + 1e-7);
        const squared = (s: Point) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
        for (const other of tokens.filter((t) => t.role !== "equipment"))
          expect(squared(site.position)).toBeLessThanOrEqual(
            squared(other.position) + 1e-6,
          );
      }
    }
  }
  expect(tokens).toEqual(original);
});

it("ignores equipment and avoids overlapping fills for coincident sites", () => {
  expect(voronoiCells([], bounds)).toEqual([]);
  expect(voronoiCells([player("ball", 100, 100, "equipment")], bounds)).toEqual(
    [],
  );
  const cells = voronoiCells(
    [
      player("ball", 100, 100, "equipment"),
      player("A", 100, 100),
      player("D", 100, 100, "defender"),
      player("near", 100 + 1e-9, 100),
    ],
    bounds,
  );
  expect(cells).toHaveLength(1);
  expect(cells[0].id).toBe("A");
  expect(area(cells[0].points)).toBe(160000);
});

it("handles collinear players and recomputes territory after movement", () => {
  const tokens = [
    player("A", 50, 100),
    player("D", 200, 100, "defender"),
    player("B", 350, 100),
  ];
  const before = voronoiCells(tokens, bounds);
  expect(before.map((cell) => area(cell.points))).toEqual([
    50000, 60000, 50000,
  ]);
  tokens[1].position.x = 150;
  const after = voronoiCells(tokens, bounds);
  expect(after.map((cell) => area(cell.points))).toEqual([40000, 60000, 60000]);
});
