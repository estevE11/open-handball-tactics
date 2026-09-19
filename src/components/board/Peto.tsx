import { PETO_COLORS } from "../../types/peto";

export function Peto({
  color,
  shapeId,
}: {
  color: keyof typeof PETO_COLORS;
  shapeId: string;
}) {
  const clipId = `${shapeId}-peto`;
  return (
    <g data-peto={color} pointerEvents="none">
      <defs>
        <clipPath id={clipId}>
          <use href={`#${shapeId}`} />
        </clipPath>
      </defs>
      <path
        clipPath={`url(#${clipId})`}
        d="M-9 -10L-4 -12Q0 -6 4 -12L9 -10L7 -3L9 12H-9L-7 -3Z"
        fill={PETO_COLORS[color].color}
        fillOpacity="0.62"
      />
    </g>
  );
}
