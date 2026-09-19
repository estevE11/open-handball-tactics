export function ConeGlyph({ size: r, color }: { size: number; color: string }) {
  return (
    <g data-equipment="cone">
      <ellipse
        cx="0"
        cy={r * 0.73}
        rx={r * 0.95}
        ry={r * 0.24}
        fill="#26392a"
        opacity=".12"
      />
      <rect
        x={-r * 0.9}
        y={r * 0.42}
        width={r * 1.8}
        height={r * 0.35}
        rx={r * 0.13}
        fill={color}
        stroke="#9b5027"
        strokeWidth=".8"
      />
      <path
        d={`M${-r * 0.63} ${r * 0.48} L${-r * 0.1} ${-r * 0.94} Q0 ${-r * 1.1} ${r * 0.1} ${-r * 0.94} L${r * 0.63} ${r * 0.48} Q0 ${r * 0.78} ${-r * 0.63} ${r * 0.48}Z`}
        fill={color}
        stroke="#9b5027"
        strokeWidth=".7"
        strokeLinejoin="round"
      />
      <path
        d={`M${-r * 0.28} ${-r * 0.45} H${r * 0.28} L${r * 0.4} ${-r * 0.12} H${-r * 0.4}Z`}
        fill="#fff9ee"
      />
      <path
        d={`M${-r * 0.48} ${r * 0.08} H${r * 0.48} L${r * 0.59} ${r * 0.37} Q0 ${r * 0.48} ${-r * 0.59} ${r * 0.37}Z`}
        fill="#fff9ee"
      />
      <path
        d={`M${r * 0.1} ${-r * 0.88} L${r * 0.6} ${r * 0.48} Q${r * 0.3} ${r * 0.62} 0 ${r * 0.64}Z`}
        fill="#783309"
        opacity=".1"
      />
    </g>
  );
}

export function LadderGlyph({
  size: r,
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <g data-equipment="ladder">
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={side * r * 0.45 - r * 0.065}
          y={-r * 1.7}
          width={r * 0.13}
          height={r * 3.4}
          rx={r * 0.035}
          fill="#3e4942"
        />
      ))}
      {Array.from({ length: 8 }, (_, index) => {
        const y = -r * 1.5 + (index * r * 3) / 7;
        return (
          <g key={index} data-ladder-rung="true">
            <rect
              x={-r * 0.56}
              y={y - r * 0.07}
              width={r * 1.12}
              height={r * 0.14}
              rx={r * 0.03}
              fill={color}
              stroke="#9b7a2c"
              strokeWidth=".55"
            />
            <path
              d={`M${-r * 0.36} ${y - r * 0.025} H${r * 0.36}`}
              stroke="white"
              strokeWidth=".6"
              opacity=".5"
            />
            {[-1, 1].map((side) => (
              <circle
                key={side}
                cx={side * r * 0.45}
                cy={y}
                r={r * 0.028}
                fill="#565443"
              />
            ))}
          </g>
        );
      })}
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${side * r * 0.45} ${-r * 1.7}v${-r * 0.1}m0 ${r * 3.5}v${r * 0.1}`}
          stroke="#525c50"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}
