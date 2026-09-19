import type { TacticalArrow, Point } from "../../types/project";
import {
  arrowPath,
  arrowEndAngles,
  editableControls,
} from "../../lib/arrowGeometry";

export function Arrow({
  arrow,
  onPointerDown,
}: {
  arrow: TacticalArrow;
  onPointerDown?: (event: React.PointerEvent) => void;
}) {
  const d = arrowPath(arrow);
  const color = arrow.color;
  const heads = arrow.heads ?? "end";
  const angles = arrowEndAngles(arrow);
  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: onPointerDown ? "move" : undefined }}
      data-arrow-id={arrow.id}
      aria-label={`${arrow.type} trajectory`}
    >
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth="16"
        data-arrow-hit="true"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={arrow.type === "pass" ? "7 6" : undefined}
        strokeLinecap="round"
        pointerEvents="none"
        data-arrow-line="true"
      />
      {(["start", "end"] as const)
        .filter((side) => heads === "both" || heads === side)
        .map((side) => (
          <path
            key={side}
            data-arrow-head={side}
            transform={`translate(${arrow[side].x} ${arrow[side].y}) rotate(${angles[side]})`}
            d={arrow.type === "screen" ? "M0 -9V9" : "M-9 -5L0 0L-9 5"}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}
    </g>
  );
}

export function ArrowHandles({
  arrow,
  onHandle,
}: {
  arrow: TacticalArrow;
  onHandle: (
    event: React.PointerEvent,
    kind: "control" | "start" | "end",
    origin: Point,
    index?: number,
  ) => void;
}) {
  const controls = editableControls(arrow);
  return (
    <g data-editor-only="true">
      <path
        d={[arrow.start, ...controls, arrow.end]
          .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
          .join(" ")}
        fill="none"
        stroke="#2563eb"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity=".4"
        pointerEvents="none"
      />
      {controls.map((p, index) => (
        <g key={index}>
          <circle
            aria-label={`Bézier point ${index + 1}`}
            cx={p.x}
            cy={p.y}
            r="5"
            fill="white"
            stroke="#2563eb"
            strokeWidth="1.5"
            style={{ cursor: "grab" }}
            onPointerDown={(e) => onHandle(e, "control", p, index)}
          />
          <text
            x={p.x + 8}
            y={p.y - 7}
            fontSize="8"
            fill="#2563eb"
            pointerEvents="none"
          >
            {index + 1}
          </text>
        </g>
      ))}
      {(["start", "end"] as const).map((key) => (
        <circle
          key={key}
          aria-label={`Arrow ${key} point`}
          cx={arrow[key].x}
          cy={arrow[key].y}
          r="5"
          fill="#2563eb"
          stroke="white"
          strokeWidth="1.5"
          style={{ cursor: "grab" }}
          onPointerDown={(e) => onHandle(e, key, arrow[key])}
        />
      ))}
    </g>
  );
}
