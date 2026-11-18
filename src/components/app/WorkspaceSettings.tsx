import { useTranslation } from "../../lib/i18n";
import { useState } from "react";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useProjectStore } from "../../store/projectStore";
import { CourtSettings } from "./CourtSettings";
import { DEFAULT_COURT } from "../../lib/projectDefaults";
import { LanguageSelect } from "./LanguageSelect";

export function WorkspaceSettings({ onClose }: { onClose: () => void }) {
  const t = useTranslation();
  const { courtDefaults, setCourtDefaults, theme, setTheme } =
    usePreferencesStore();
  const project = useProjectStore((state) => state.project);
  const [draft, setDraft] = useState(() => structuredClone(courtDefaults));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="workspace-settings">
      <LanguageSelect />
      <label className="theme-preference">
        {t("Appearance")}
        <select
          aria-label={t("Interface theme")}
          value={theme}
          onChange={(e) => {
            try {
              setTheme(e.target.value as typeof theme);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save appearance.",
              );
            }
          }}
        >
          <option value="system">{t("Follow system")}</option>
          <option value="light">{t("Light")}</option>
          <option value="dark">{t("Dark")}</option>
        </select>
      </label>
      <p className="muted">
        {t(
          "Your defaults for new drills on this browser. Each drill can override every setting below.",
        )}
      </p>
      <CourtSettings config={draft} onChange={setDraft} />
      {error && (
        <p role="alert" className="dialog-error">
          {t(error)}
        </p>
      )}
      <div className="defaults-actions">
        <button
          className="text-button"
          disabled={!project}
          onClick={() => {
            if (project) setDraft(structuredClone(project.courtConfig));
          }}
        >
          {t("Use current drill")}
        </button>
        <button
          className="text-button"
          onClick={() => setDraft(structuredClone(DEFAULT_COURT))}
        >
          {t("Reset defaults")}
        </button>
      </div>
      <div className="modal-actions">
        <button
          className="button primary"
          onClick={() => {
            try {
              setCourtDefaults(draft);
              onClose();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save preferences.",
              );
            }
          }}
        >
          {t("Save defaults")}
        </button>
      </div>
    </div>
  );
}
