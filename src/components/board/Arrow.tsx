import type { TacticalArrow } from "../../types/project";

export function Arrow({
  arrow,
  selected,
  onSelect,
  onControl,
}: {
  arrow: TacticalArrow;
  selected?: boolean;
  onSelect?: () => void;
  onControl?: (event: React.PointerEvent) => void;
}) {
  const { start: s, end: e, control: c, type, color } = arrow;
  const angle =
    (Math.atan2(e.y - (c?.y ?? s.y), e.x - (c?.x ?? s.x)) * 180) / Math.PI;
  let d = c
    ? `M${s.x} ${s.y} Q${c.x} ${c.y} ${e.x} ${e.y}`
    : `M${s.x} ${s.y} L${e.x} ${e.y}`;
  if (type === "dribble") {
    const dx = e.x - s.x,
      dy = e.y - s.y,
      length = Math.hypot(dx, dy) || 1;
    const points = Array.from({ length: 81 }, (_, i) => {
      const t = i / 80,
        u = 1 - t;
      const x = c ? u * u * s.x + 2 * u * t * c.x + t * t * e.x : s.x + dx * t;
      const y = c ? u * u * s.y + 2 * u * t * c.y + t * t * e.y : s.y + dy * t;
      const wave =
        Math.sin(t * Math.PI * 2 * Math.max(2, Math.round(length / 22))) * 3;
      return `${i ? "L" : "M"}${x - (dy / length) * wave} ${y + (dx / length) * wave}`;
    });
    d = points.join(" ");
  }
  return (
    <g
      onPointerDown={(event) => {
        if (onSelect) {
          event.stopPropagation();
          onSelect();
        }
      }}
      style={{ cursor: onSelect ? "pointer" : undefined }}
    >
      <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
      <path
        d={d}
        fill="none"
        stroke={selected ? "#2563eb" : color}
        strokeWidth="2.5"
        strokeDasharray={type === "pass" ? "7 6" : undefined}
        strokeLinecap="round"
      />
      <path
        transform={`translate(${e.x} ${e.y}) rotate(${angle})`}
        d={type === "screen" ? "M0 -9V9" : "M-9 -5L0 0L-9 5"}
        fill="none"
        stroke={selected ? "#2563eb" : color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {selected && (
        <>
          <path
            d={`M${s.x} ${s.y}L${c?.x ?? (s.x + e.x) / 2} ${c?.y ?? (s.y + e.y) / 2}L${e.x} ${e.y}`}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <circle
            aria-label="Curve control"
            cx={c?.x ?? (s.x + e.x) / 2}
            cy={c?.y ?? (s.y + e.y) / 2}
            r="6"
            fill="white"
            stroke="#2563eb"
            strokeWidth="2"
            onPointerDown={onControl}
          />
        </>
      )}
    </g>
  );
}
