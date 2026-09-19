import {
  MousePointer2,
  Circle,
  Triangle,
  Square,
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
} from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import type { Tool } from "../../types/project";

const groups: { tool: Tool; label: string; icon: typeof Circle }[][] = [
  [{ tool: "select", label: "Select & move (V)", icon: MousePointer2 }],
  [
    { tool: "attacker", label: "Attacker", icon: Circle },
    { tool: "defender", label: "Defender", icon: Triangle },
    { tool: "goalkeeper", label: "Goalkeeper", icon: Square },
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
export function Toolbar() {
  const { tool, setTool, undo, redo, past, future } = useProjectStore();
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
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
        </div>
      ))}
      <div className="tool-group history">
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
  );
}
