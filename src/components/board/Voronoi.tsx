import type { DrillProject, TacticalToken } from "../../types/project";
import { voronoiCells } from "../../lib/voronoi";

export function Voronoi({
  tokens,
  project,
  width,
  height,
}: {
  tokens: TacticalToken[];
  project: DrillProject;
  width: number;
  height: number;
}) {
  const colors = {
    attacker:
      project.teamKits?.attacker?.primary ??
      tokens.find((t) => t.role === "attacker")?.color ??
      "#4f8cba",
    defender:
      project.teamKits?.defender?.primary ??
      tokens.find((t) => t.role === "defender")?.color ??
      "#eaa958",
  };
  return (
    <g
      data-voronoi="true"
      aria-label="Voronoi team control"
      pointerEvents="none"
      stroke="#46564d"
      strokeWidth="1"
      strokeLinejoin="round"
    >
      {voronoiCells(tokens, { width, height }).map((cell) => (
        <polygon
          key={cell.id}
          data-voronoi-player={cell.id}
          data-voronoi-team={cell.team}
          points={cell.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={colors[cell.team]}
          fillOpacity="0.3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
