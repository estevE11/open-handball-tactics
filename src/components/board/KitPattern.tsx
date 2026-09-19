import type { PlayerKit } from "../../types/kit";

export function KitPattern({ kit, id }: { kit: PlayerKit; id: string }) {
  const angle = {
    vertical: 0,
    horizontal: 90,
    diagonal: 45,
    reverse_diagonal: -45,
  }[kit.direction];
  const stripeWidth = 32 / (kit.stripeCount * 2 + 1);
  return (
    <defs>
      <pattern
        id={id}
        patternUnits="userSpaceOnUse"
        x="-16"
        y="-16"
        width="32"
        height="32"
        viewBox="-16 -16 32 32"
        data-kit-pattern={kit.pattern}
      >
        <rect x="-16" y="-16" width="32" height="32" fill={kit.primary} />
        <g transform={`rotate(${angle})`} fill={kit.secondary}>
          {kit.pattern === "halves" && (
            <rect x="0" y="-32" width="32" height="64" />
          )}
          {kit.pattern === "stripes" &&
            Array.from({ length: kit.stripeCount }, (_, index) => (
              <rect
                key={index}
                data-kit-stripe="true"
                x={-16 + stripeWidth * (1 + index * 2)}
                y="-32"
                width={stripeWidth}
                height="64"
              />
            ))}
        </g>
      </pattern>
    </defs>
  );
}
