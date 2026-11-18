import { useTranslation } from "../../lib/i18n";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { KitRole, PlayerKit } from "../../types/kit";
import { applyKit, kitDisplayName } from "../../lib/kits";
import { useProjectStore } from "../../store/projectStore";
import { KitPreview } from "./KitPreview";
import { KitPicker } from "./KitPicker";

export function PlayerKits() {
  const t = useTranslation();
  const project = useProjectStore((state) => state.project);
  const [role, setRole] = useState<KitRole | null>(null);
  if (!project) return null;
  function apply(kit?: PlayerKit) {
    const state = useProjectStore.getState();
    if (!role || state.project?.id !== project?.id) return;
    state.edit((draft) => {
      applyKit(draft, role, kit);
      const other = role === "attacker" ? "defender" : "attacker";
      if (kit && draft.teamKits?.[other]?.id === kit.id)
        applyKit(draft, other, kit);
    });
    setRole(null);
  }
  return (
    <section className="inspector-section player-kits">
      <h3>{t("Player kits")}</h3>
      {(["attacker", "defender"] as const).map((team) => (
        <button
          key={team}
          className="kit-team-button"
          aria-label={t("{v0} kit", {
            v0: team === "attacker" ? t("Attacker") : t("Defender"),
          })}
          onClick={() => setRole(team)}
        >
          <KitPreview kit={project.teamKits?.[team]} role={team} />
          <span>
            <strong>
              {team === "attacker" ? t("Attackers") : t("Defenders")}
            </strong>
            <small>
              {project.teamKits?.[team]
                ? kitDisplayName(project.teamKits[team]!)
                : t("Player colors")}
            </small>
          </span>
          <ChevronRight size={14} />
        </button>
      ))}
      {role && (
        <KitPicker
          role={role}
          current={project.teamKits?.[role]}
          onApply={apply}
          onClose={() => setRole(null)}
        />
      )}
    </section>
  );
}
