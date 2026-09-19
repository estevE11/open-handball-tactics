import { useState } from "react";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useProjectStore } from "../../store/projectStore";
import { CourtSettings } from "./CourtSettings";
import { DEFAULT_COURT } from "../../lib/projectDefaults";

export function WorkspaceSettings({ onClose }: { onClose: () => void }) {
  const { courtDefaults, setCourtDefaults } = usePreferencesStore();
  const project = useProjectStore((state) => state.project);
  const [draft, setDraft] = useState(() => structuredClone(courtDefaults));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="workspace-settings">
      <p className="muted">
        Your defaults for new drills on this browser. Each drill can override
        every setting below.
      </p>
      <CourtSettings config={draft} onChange={setDraft} />
      {error && (
        <p role="alert" className="dialog-error">
          {error}
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
          Use current drill
        </button>
        <button
          className="text-button"
          onClick={() => setDraft(structuredClone(DEFAULT_COURT))}
        >
          Reset defaults
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
          Save defaults
        </button>
      </div>
    </div>
  );
}
