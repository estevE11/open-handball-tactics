import { useId } from "react";
import type { PlayerKit } from "../../types/kit";
import { KitPattern } from "./KitPattern";
import { Peto } from "./Peto";
import type { TacticalToken } from "../../types/project";
import { tokenRotation } from "../../lib/projectCompatibility";
import { tokenLabelAngle, labelOutline } from "../../lib/tokenLabels";
import { ConeGlyph, LadderGlyph } from "./Equipment";

export function Token({
  token: t,
  selected,
  labels = true,
  image,
  onPointerDown,
  onRotate,
  playerScale = 1,
  sceneRotation = 0,
  kit,
}: {
  token: TacticalToken;
  selected?: boolean;
  labels?: boolean;
  playerScale?: number;
  sceneRotation?: number;
  kit?: PlayerKit;
  image?: string;
  onPointerDown?: (event: React.PointerEvent) => void;
  onRotate?: (event: React.PointerEvent) => void;
}) {
  const outlineId = useId();
  const isPlayer = t.role !== "equipment";
  const kitId = `${outlineId}-kit`;
  const shapeId = `${outlineId}-shape`;
  const fill =
    t.equipment === "ball"
      ? "#f6f1e7"
      : isPlayer && kit
        ? `url(#${kitId})`
        : t.color;
  // Shape and lettering share native coordinates, so every transform stays uniform.
  const r = isPlayer ? 14 : t.size;
  const contentScale = isPlayer ? (t.size / 14) * playerScale : 1;
  const displayRadius = r * contentScale;
  const handleRadius =
    t.equipment === "ladder" ? displayRadius * 1.8 : displayRadius;
  const rotation = tokenRotation(t);
  const labelColor =
    kit?.labelColor ?? (t.role === "defender" ? "#563b1e" : "white");
  const outlineLabel = !!kit || !!t.peto?.enabled;
  return (
    <g
      transform={`translate(${t.position.x} ${t.position.y})`}
      onPointerDown={onPointerDown}
      role="img"
      aria-label={`${t.role} ${t.label || t.equipment || ""}`}
      style={{ cursor: onPointerDown ? "grab" : undefined }}
      data-kit-id={isPlayer ? kit?.id : undefined}
    >
      <g transform={`rotate(${rotation})`} data-token-body="true">
        {selected && (
          <defs data-editor-only="true">
            <filter
              id={outlineId}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
              colorInterpolationFilters="sRGB"
            >
              <feMorphology
                in="SourceAlpha"
                operator="dilate"
                radius="2"
                result="padding"
              />
              <feMorphology
                in="SourceAlpha"
                operator="dilate"
                radius="3.5"
                result="outline"
              />
              <feComposite
                in="outline"
                in2="padding"
                operator="out"
                result="ring"
              />
              <feFlood floodColor="#2563eb" result="blue" />
              <feComposite
                in="blue"
                in2="ring"
                operator="in"
                result="selection"
              />
              <feMerge>
                <feMergeNode in="selection" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        <g
          data-token-glyph="true"
          filter={selected ? `url(#${outlineId})` : undefined}
        >
          <g transform={`scale(${contentScale})`}>
            {isPlayer && kit && <KitPattern kit={kit} id={kitId} />}
            {t.equipment === "image" ? (
              <image href={image} x={-r} y={-r} width={r * 2} height={r * 2} />
            ) : t.equipment === "cone" ? (
              <ConeGlyph size={r} color={t.color} />
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
              <LadderGlyph size={r} color={t.color} />
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
                    id={isPlayer ? shapeId : undefined}
                    fill={fill}
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
                    id={isPlayer ? shapeId : undefined}
                    fill={fill}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                ) : (
                  <circle
                    r={r}
                    id={isPlayer ? shapeId : undefined}
                    fill={fill}
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
            {isPlayer && t.peto?.enabled && (
              <Peto color={t.peto.color} shapeId={shapeId} />
            )}
            {!t.equipment && labels && (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                transform={`translate(0 ${t.shape === "triangle" ? 10 / 3 : 0}) rotate(${tokenLabelAngle(t) - rotation - sceneRotation})`}
                fontFamily="Arial, sans-serif"
                fontSize={t.label.length > 2 ? 8 : 11}
                fontWeight="700"
                fill={labelColor}
                stroke={outlineLabel ? labelOutline(labelColor) : undefined}
                strokeWidth={outlineLabel ? 0.8 : undefined}
                strokeLinejoin="round"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {t.label}
              </text>
            )}
          </g>
        </g>
        {selected && onRotate && (
          <g data-editor-only="true">
            <path
              d={`M0 -${handleRadius + 5}V-${handleRadius + 16}`}
              stroke="#2563eb"
              strokeWidth="1"
            />
            <circle
              aria-label="Rotate object"
              cx="0"
              cy={-handleRadius - 19}
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
    </g>
  );
}
