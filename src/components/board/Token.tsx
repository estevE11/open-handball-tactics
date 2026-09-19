import type { TacticalToken } from "../../types/project";
import { tokenRotation } from "../../lib/projectCompatibility";

export function Token({
  token: t,
  selected,
  labels = true,
  image,
  onPointerDown,
  onRotate,
}: {
  token: TacticalToken;
  selected?: boolean;
  labels?: boolean;
  image?: string;
  onPointerDown?: (event: React.PointerEvent) => void;
  onRotate?: (event: React.PointerEvent) => void;
}) {
  const r = t.size;
  const rotation = tokenRotation(t);
  return (
    <g
      transform={`translate(${t.position.x} ${t.position.y})`}
      onPointerDown={onPointerDown}
      role="img"
      aria-label={`${t.role} ${t.label || t.equipment || ""}`}
      style={{ cursor: onPointerDown ? "grab" : undefined }}
    >
      <g transform={`rotate(${rotation})`} data-token-body="true">
        {selected && (
          <rect
            x={-r - 5}
            y={-r - 5}
            width={r * 2 + 10}
            height={r * 2 + 10}
            rx="4"
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        )}
        {t.equipment === "image" ? (
          <image href={image} x={-r} y={-r} width={r * 2} height={r * 2} />
        ) : t.equipment === "text" ? (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={r}
            fill={t.color}
            fontFamily="Arial, sans-serif"
          >
            {t.label}
          </text>
        ) : t.equipment === "ladder" ? (
          <g stroke={t.color} strokeWidth="3">
            <path d={`M-${r / 2} -${r}V${r}M${r / 2} -${r}V${r}`} />
            {[-1, -0.5, 0, 0.5, 1].map((y) => (
              <path key={y} d={`M-${r / 2} ${y * r}h${r}`} />
            ))}
          </g>
        ) : t.equipment === "goal" ? (
          <path
            d={`M-${r} ${r / 2}V-${r / 2}H${r}V${r / 2}`}
            fill="none"
            stroke={t.color}
            strokeWidth="4"
          />
        ) : (
          <>
            {t.shape === "triangle" ? (
              <path
                d={`M0 -${r + 2}L${r + 2} ${r - 1}H-${r + 2}Z`}
                fill={t.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            ) : t.shape === "square" ? (
              <rect
                x={-r}
                y={-r}
                width={r * 2}
                height={r * 2}
                rx="4"
                fill={t.color}
                stroke="white"
                strokeWidth="1.5"
              />
            ) : (
              <circle
                r={r}
                fill={t.color}
                stroke={t.equipment === "ball" ? "#4b514d" : "white"}
                strokeWidth="1.5"
              />
            )}
            {t.equipment === "ball" && (
              <path
                d={`M0 -${r}L-${r / 2} 0L0 ${r}M-${r / 2} 0H${r}`}
                fill="none"
                stroke="#4b514d"
                strokeWidth="1"
              />
            )}
          </>
        )}
        {selected && onRotate && (
          <g data-editor-only="true">
            <path
              d={`M0 -${r + 5}V-${r + 16}`}
              stroke="#2563eb"
              strokeWidth="1"
            />
            <circle
              aria-label="Rotate object"
              cx="0"
              cy={-r - 19}
              r="5"
              fill="white"
              stroke="#2563eb"
              strokeWidth="1.5"
              style={{ cursor: "crosshair" }}
              onPointerDown={onRotate}
            />
          </g>
        )}
      </g>
      {!t.equipment && labels && (
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Arial, sans-serif"
          fontSize={t.label.length > 2 ? 8 : 11}
          fontWeight="700"
          fill={t.role === "defender" ? "#563b1e" : "white"}
          pointerEvents="none"
        >
          {t.label}
        </text>
      )}
    </g>
  );
}
