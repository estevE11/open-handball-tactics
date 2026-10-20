import {
  MousePointer2,
  Circle,
  Triangle,
  MoveUpRight,
  ArrowUpRight,
  Waves,
  GitCommitHorizontal,
  CircleDot,
  Cone,
  Goal,
  AlignJustify,
  Type,
  Undo2,
  Redo2,
  Pencil,
  Eraser,
  Trash2,
  Hexagon,
} from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import type { Tool } from "../../types/project";

const groups: { tool: Tool; label: string; icon: typeof Circle }[][] = [
  [{ tool: "select", label: "Select & move (V)", icon: MousePointer2 }],
  [
    { tool: "draw", label: "Freehand drawing (B)", icon: Pencil },
    { tool: "erase", label: "Erase whole strokes (E)", icon: Eraser },
  ],
  [
    { tool: "attacker", label: "Attacker", icon: Circle },
    { tool: "defender", label: "Defender", icon: Triangle },
    { tool: "goalkeeper", label: "Goalkeeper", icon: Triangle },
  ],
  [
    { tool: "run", label: "Run arrow", icon: MoveUpRight },
    { tool: "pass", label: "Pass arrow", icon: ArrowUpRight },
    { tool: "dribble", label: "Dribble arrow", icon: Waves },
    { tool: "screen", label: "Screen / block", icon: GitCommitHorizontal },
  ],
  [
    { tool: "ball", label: "Ball", icon: CircleDot },
    { tool: "cone", label: "Cone", icon: Cone },
    { tool: "goal", label: "Mini goal", icon: Goal },
    { tool: "ladder", label: "Agility ladder", icon: AlignJustify },
    { tool: "text", label: "Text note", icon: Type },
  ],
];
export function Toolbar({
  orientation = "horizontal",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const {
    tool,
    setTool,
    undo,
    redo,
    past,
    future,
    project,
    frameIndex,
    edit,
    voronoi,
    setVoronoi,
  } = useProjectStore();
  const strokeCount = project?.keyframes[frameIndex].drawings?.length ?? 0;
  return (
    <>
      <div
        className="toolbar"
        role="toolbar"
        aria-label="Drawing tools"
        aria-orientation={orientation}
      >
        {groups.map((group, index) => (
          <div className="tool-group" key={index}>
            {group.map(({ tool: value, label, icon: Icon }) => (
              <button
                key={value}
                aria-label={label}
                title={label}
                aria-pressed={tool === value}
                className={`tool ${tool === value ? "active" : ""} tool-${value}`}
                onClick={() => setTool(value)}
              >
                <Icon size={18} />
              </button>
            ))}
            {index === 1 && (
              <button
                className="tool clear-drawing"
                aria-label="Clear drawing"
                title="Clear drawing in this step (can be undone)"
                disabled={!strokeCount}
                onClick={() =>
                  edit((draft) => {
                    draft.keyframes[frameIndex].drawings = [];
                  })
                }
              >
                <Trash2 size={17} />
                <span>Clear drawing</span>
              </button>
            )}
          </div>
        ))}
        <div className="tool-group history">
          <button
            className={`tool ${voronoi ? "active" : ""}`}
            aria-label="Voronoi mode"
            title="Voronoi team spaces"
            aria-pressed={voronoi}
            onClick={() => setVoronoi(!voronoi)}
          >
            <Hexagon size={17} />
          </button>
          <button
            className="tool"
            aria-label="Undo"
            title="Undo (⌘Z)"
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="tool"
            aria-label="Redo"
            title="Redo (⌘⇧Z)"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
