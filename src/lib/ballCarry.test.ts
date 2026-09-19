import { expect, it } from "vitest";
import type { TacticalToken } from "../types/project";
import {
  ballTouchesPlayer,
  carriedBalls,
  dragTokenPositions,
} from "./ballCarry";

const player: TacticalToken = {
  id: "player",
  role: "attacker",
  shape: "circle",
  label: "A",
  color: "#ffffff",
  size: 14,
  rotation: 0,
  position: { x: 100, y: 100 },
};
const ball: TacticalToken = {
  ...player,
  id: "ball",
  role: "equipment",
  equipment: "ball",
  size: 6,
  position: { x: 120, y: 100 },
};

it("uses visible circle contact, including strokes, individual size, and global scale", () => {
  expect(ballTouchesPlayer(ball, player)).toBe(true);
  expect(
    ballTouchesPlayer({ ...ball, position: { x: 122, y: 100 } }, player),
  ).toBe(false);
  expect(ballTouchesPlayer(ball, { ...player, size: 7 })).toBe(false);
  expect(ballTouchesPlayer(ball, { ...player, size: 7 }, 2)).toBe(true);
  expect(
    ballTouchesPlayer({ ...ball, position: { ...player.position } }, player),
  ).toBe(true);
});

it("checks rotated triangles and rounded square corners instead of bounding boxes", () => {
  const triangle = {
    ...player,
    role: "defender" as const,
    shape: "triangle" as const,
  };
  const atTip = { ...ball, size: 2, position: { x: 100, y: 81 } };
  expect(ballTouchesPlayer(atTip, triangle)).toBe(true);
  expect(ballTouchesPlayer(atTip, { ...triangle, rotation: 180 })).toBe(false);
  expect(
    ballTouchesPlayer(
      { ...ball, size: 2, position: { x: 114, y: 86 } },
      triangle,
    ),
  ).toBe(false);
  const corner = { ...ball, size: 2, position: { x: 116, y: 116 } };
  expect(ballTouchesPlayer(corner, { ...player, shape: "square" })).toBe(false);
  expect(
    ballTouchesPlayer(
      { ...corner, position: { x: 113, y: 113 } },
      { ...player, shape: "square" },
    ),
  ).toBe(true);
  expect(
    ballTouchesPlayer(ball, {
      ...player,
      role: "goalkeeper",
      shape: "triangle",
      rotation: 90,
    }),
  ).toBe(true);
});

it("carries all touching balls but never players or other equipment", () => {
  const second = { ...ball, id: "second", position: { x: 80, y: 100 } };
  const cone = { ...ball, id: "cone", equipment: "cone" as const };
  const tokens = [player, ball, second, cone];
  expect(carriedBalls(tokens, player.id)).toEqual([ball.id, second.id]);
  expect(carriedBalls(tokens, ball.id)).toEqual([]);
  expect(carriedBalls(tokens, cone.id)).toEqual([]);
  const before = structuredClone(tokens);
  const positions = dragTokenPositions(
    tokens,
    player.id,
    { x: 200, y: 150 },
    carriedBalls(tokens, player.id),
    { width: 400, height: 400 },
  );
  expect(positions.get(ball.id)).toEqual({ x: 220, y: 150 });
  expect(positions.get(second.id)).toEqual({ x: 180, y: 150 });
  expect(positions.has(cone.id)).toBe(false);
  expect(tokens).toEqual(before);
});

it("keeps a ball drag independent and preserves carried offsets at the boundary", () => {
  const tokens = [player, ball];
  const independent = dragTokenPositions(
    tokens,
    ball.id,
    { x: 80, y: 50 },
    carriedBalls(tokens, ball.id),
    { width: 400, height: 400 },
  );
  expect([...independent]).toEqual([[ball.id, { x: 80, y: 50 }]]);
  const group = dragTokenPositions(
    tokens,
    player.id,
    { x: 400, y: 200 },
    [ball.id],
    { width: 400, height: 400 },
  );
  expect(group.get(player.id)).toEqual({ x: 380, y: 200 });
  expect(group.get(ball.id)).toEqual({ x: 400, y: 200 });
});
