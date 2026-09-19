import { useState } from "react";
import type { PlayerKit } from "../../types/kit";
import { kitDirections, kitLibrary } from "../../lib/kits";
import { KitPreview } from "./KitPreview";

export function KitEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: PlayerKit;
  onSave: (kit: PlayerKit) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function change(patch: Partial<PlayerKit>) {
    setDraft({ ...draft, ...patch });
    setError("");
  }
  return (
    <form
      className="kit-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!draft.name.trim()) {
          setError("Give your kit a name.");
          return;
        }
        setSaving(true);
        try {
          onSave(await kitLibrary.save(draft));
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Could not save this kit.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="kit-editor-preview">
        <div>
          <KitPreview kit={draft} />
          <span>Attackers</span>
        </div>
        <div>
          <KitPreview kit={draft} role="defender" />
          <span>Defenders</span>
        </div>
      </div>
      <label>
        Kit name
        <input
          autoFocus
          required
          maxLength={80}
          value={draft.name}
          onChange={(e) => change({ name: e.target.value })}
          placeholder="e.g. Home · blue stripes"
        />
      </label>
      <div className="two-cols">
        <label>
          Pattern
          <select
            value={draft.pattern}
            onChange={(e) =>
              change({ pattern: e.target.value as PlayerKit["pattern"] })
            }
          >
            <option value="solid">Solid color</option>
            <option value="stripes">Stripes</option>
            <option value="halves">Two-color halves</option>
          </select>
        </label>
        {draft.pattern !== "solid" && (
          <label>
            Direction
            <select
              value={draft.direction}
              onChange={(e) =>
                change({ direction: e.target.value as PlayerKit["direction"] })
              }
            >
              {Object.entries(kitDirections).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {draft.pattern === "stripes" && (
        <label>
          Stripe count
          <select
            value={draft.stripeCount}
            onChange={(e) => change({ stripeCount: Number(e.target.value) })}
          >
            {[1, 2, 3].map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "stripe" : "stripes"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="kit-colors">
        <label>
          Primary color
          <input
            type="color"
            value={draft.primary}
            onChange={(e) => change({ primary: e.target.value })}
          />
        </label>
        {draft.pattern !== "solid" && (
          <label>
            Secondary color
            <input
              type="color"
              value={draft.secondary}
              onChange={(e) => change({ secondary: e.target.value })}
            />
          </label>
        )}
        <label>
          Label color
          <input
            type="color"
            value={draft.labelColor}
            onChange={(e) => change({ labelColor: e.target.value })}
          />
        </label>
      </div>
      <p className="muted">
        Saved in your kit library and applied to this drill.
      </p>
      {error && (
        <p role="alert" className="dialog-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Back to kits
        </button>
        <button className="button primary" disabled={saving}>
          {saving ? "Saving…" : "Save and apply"}
        </button>
      </div>
    </form>
  );
}
