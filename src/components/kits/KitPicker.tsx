import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Pencil, Check } from "lucide-react";
import type { KitRole, PlayerKit } from "../../types/kit";
import { BASIC_KITS, kitLibrary, newKit } from "../../lib/kits";
import { Modal } from "../ui/Modal";
import { KitPreview } from "./KitPreview";
import { KitEditor } from "./KitEditor";

export function KitPicker({
  role,
  current,
  onApply,
  onClose,
}: {
  role: KitRole;
  current?: PlayerKit;
  onApply: (kit?: PlayerKit) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<{
    kit: PlayerKit;
    creating: boolean;
  } | null>(null);
  const result = useLiveQuery(
    () =>
      kitLibrary
        .list()
        .then((kits) => ({ kits, error: "" }))
        .catch(() => ({
          kits: [],
          error: "Could not read your saved kits. Try reopening the kit menu.",
        })),
    [],
    { kits: [], error: "" },
  );
  function customize(kit: PlayerKit) {
    const basic = kit.id.startsWith("basic-");
    setEditing({
      kit: {
        ...structuredClone(kit),
        id: basic ? crypto.randomUUID() : kit.id,
      },
      creating: basic,
    });
  }
  function cards(kits: PlayerKit[]) {
    return (
      <div className="kit-grid">
        {kits.map((kit) => (
          <div
            className={`kit-card ${current?.id === kit.id ? "active" : ""}`}
            key={kit.id}
          >
            <button
              className="kit-use"
              aria-label={`Use ${kit.name}`}
              aria-pressed={current?.id === kit.id}
              onClick={() => onApply(kit)}
            >
              <KitPreview kit={kit} role={role} />
              <span>{kit.name}</span>
              {current?.id === kit.id && <Check size={13} />}
            </button>
            <button
              className="kit-edit"
              aria-label={`Edit ${kit.name}`}
              onClick={() => customize(kit)}
            >
              <Pencil size={12} />
              {kit.id.startsWith("basic-") ? "Customize" : "Edit"}
            </button>
          </div>
        ))}
      </div>
    );
  }
  const missingCurrent =
    current &&
    ![...result.kits, ...BASIC_KITS].some((kit) => kit.id === current.id);
  return (
    <Modal
      title={
        editing
          ? editing.creating
            ? "Create kit"
            : "Edit kit"
          : `${role === "attacker" ? "Attacker" : "Defender"} kits`
      }
      onClose={onClose}
    >
      {editing ? (
        <KitEditor
          key={editing.kit.id}
          initial={editing.kit}
          onCancel={() => setEditing(null)}
          onSave={onApply}
        />
      ) : (
        <div className="kit-library">
          <p className="muted">
            Applies to all {role === "attacker" ? "attackers" : "defenders"} in
            this drill, across every step.
          </p>
          <div className="kit-menu-actions">
            <button
              className="button primary"
              onClick={() => setEditing({ kit: newKit(), creating: true })}
            >
              <Plus size={14} /> Create kit
            </button>
            <button className="text-button" onClick={() => onApply()}>
              Use player colors
            </button>
          </div>
          {result.error && (
            <p className="dialog-error" role="alert">
              {result.error}
            </p>
          )}
          {missingCurrent && (
            <>
              <h3>Current kit</h3>
              {cards([current])}
            </>
          )}
          <h3>Your kits</h3>
          {result.kits.length ? (
            cards(result.kits)
          ) : (
            <p className="muted">
              Create a kit or customize a basic design to start your collection.
            </p>
          )}
          <h3>Basic designs</h3>
          {cards(BASIC_KITS)}
        </div>
      )}
    </Modal>
  );
}
