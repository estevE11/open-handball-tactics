import type { KitRole, PlayerKit } from "../../types/kit";
import { Token } from "../board/Token";

export function KitPreview({
  kit,
  role = "attacker",
}: {
  kit?: PlayerKit;
  role?: KitRole;
}) {
  return (
    <svg className="kit-preview" viewBox="-21 -21 42 42" aria-hidden="true">
      <Token
        kit={kit}
        token={{
          id: "preview",
          role,
          shape: role === "defender" ? "triangle" : "circle",
          label: role === "defender" ? "2" : "B",
          color: role === "defender" ? "#eaa958" : "#4f8cba",
          size: 14,
          position: { x: 0, y: 0 },
          rotation: role === "defender" ? 180 : 0,
        }}
      />
    </svg>
  );
}
