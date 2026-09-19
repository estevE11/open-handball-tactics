import type { Point, TacticalToken } from "../types/project";
import { tokenRotation } from "./projectCompatibility";

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function ballTouchesPlayer(
  ball: TacticalToken,
  player: TacticalToken,
  playerScale = 1,
) {
  if (ball.equipment !== "ball" || player.role === "equipment") return false;
  // Match Token's native 14-unit geometry, shared scale, rotation, and strokes.
  const scale = (player.size / 14) * playerScale;
  const angle = (-tokenRotation(player) * Math.PI) / 180;
  const dx = ball.position.x - player.position.x,
    dy = ball.position.y - player.position.y;
  const p = {
    x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / scale,
    y: (dx * Math.sin(angle) + dy * Math.cos(angle)) / scale,
  };
  const reach = (ball.size + 0.75) / scale + 0.75;
  if (player.shape === "circle") return Math.hypot(p.x, p.y) <= 14 + reach;
  if (player.shape === "square") {
    // Signed distance to the rounded square (radius 4).
    const x = Math.abs(p.x) - 10,
      y = Math.abs(p.y) - 10;
    return (
      Math.hypot(Math.max(x, 0), Math.max(y, 0)) +
        Math.min(Math.max(x, y), 0) -
        4 <=
      reach
    );
  }
  const vertices = [
    { x: 0, y: -16 },
    { x: 16, y: 13 },
    { x: -16, y: 13 },
  ];
  const cross = vertices.map((a, i) => {
    const b = vertices[(i + 1) % 3];
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  });
  if (cross.every((value) => value >= 0) || cross.every((value) => value <= 0))
    return true;
  return vertices.some(
    (a, i) => segmentDistance(p, a, vertices[(i + 1) % 3]) <= reach,
  );
}

export function carriedBalls(
  tokens: TacticalToken[],
  playerId: string,
  playerScale = 1,
) {
  const player = tokens.find((token) => token.id === playerId);
  return player
    ? tokens
        .filter((ball) => ballTouchesPlayer(ball, player, playerScale))
        .map((ball) => ball.id)
    : [];
}

// Capture the group at pointer-down; a moving ball never carries other objects.
// Clamp the shared delta, preserving every offset even at court boundaries.
export function dragTokenPositions(
  tokens: TacticalToken[],
  id: string,
  target: Point,
  ballIds: string[],
  bounds: { width: number; height: number },
) {
  const token = tokens.find((item) => item.id === id);
  const positions = new Map<string, Point>();
  if (!token) return positions;
  const group = tokens.filter(
    (item) => item.id === id || ballIds.includes(item.id),
  );
  const delta = {
    x: Math.max(
      -Math.min(...group.map((item) => item.position.x)),
      Math.min(
        bounds.width - Math.max(...group.map((item) => item.position.x)),
        target.x - token.position.x,
      ),
    ),
    y: Math.max(
      -Math.min(...group.map((item) => item.position.y)),
      Math.min(
        bounds.height - Math.max(...group.map((item) => item.position.y)),
        target.y - token.position.y,
      ),
    ),
  };
  for (const item of group)
    positions.set(item.id, {
      x: item.position.x + delta.x,
      y: item.position.y + delta.y,
    });
  return positions;
}
