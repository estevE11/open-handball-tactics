import { useTranslation } from "../../lib/i18n";
import {
  Circle,
  Triangle,
  Square,
  Trash2,
  Check,
  X,
  Plus,
  RotateCcw,
} from "lucide-react";
import { PETO_COLORS } from "../../types/peto";
import { playerKit } from "../../lib/kits";
import {
  addControl,
  arrowControls,
  editableControls,
  withControls,
} from "../../lib/arrowGeometry";
import { tokenRotation } from "../../lib/projectCompatibility";
import { useProjectStore } from "../../store/projectStore";
import type { TacticalToken } from "../../types/project";
import { NumberStepper } from "../ui/NumberStepper";

export function ItemProperties({ onClose }: { onClose: () => void }) {
  const t = useTranslation();
  const { project, frameIndex, edit, selected, setSelected } =
    useProjectStore();
  if (!project) return null;
  const frame = project.keyframes[frameIndex];
  const token = frame.tokens.find((t) => t.id === selected);
  const arrow = frame.arrows.find((a) => a.id === selected);
  if (!token && !arrow) return null;
  const name = token ? (token.equipment ?? token.role) : "trajectory";
  function updateToken(patch: Partial<TacticalToken>) {
    edit((d) => {
      const t = d.keyframes[frameIndex].tokens.find((t) => t.id === selected);
      if (t) Object.assign(t, patch);
    });
  }
  function remove() {
    edit((d) => {
      const f = d.keyframes[frameIndex];
      f.tokens = f.tokens.filter((t) => t.id !== selected);
      f.arrows = f.arrows.filter((a) => a.id !== selected);
      const used = new Set(
        d.keyframes.flatMap((f) => f.tokens.map((t) => t.assetId)),
      );
      d.customAssets = d.customAssets.filter((a) => used.has(a.id));
    });
    setSelected(null);
    onClose();
  }
  return (
    <>
      <header className="item-properties-heading">
        <h2>
          {t(`${name.charAt(0).toUpperCase() + name.slice(1)} properties`)}
        </h2>
        <button className="text-button danger" onClick={remove}>
          <Trash2 size={15} /> {t("Delete")}
        </button>
        <button
          className="icon-button"
          aria-label={t("Close item properties")}
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <div className="item-properties-fields">
        {token && (
          <>
            <label>
              {t("Label")}
              <input
                aria-label={t("Token label")}
                maxLength={80}
                value={token.label}
                onChange={(e) => updateToken({ label: e.target.value })}
              />
            </label>
            {!token.equipment && (
              <div className="shape-options">
                {(["circle", "triangle", "square"] as const).map((shape, i) => {
                  const Icon = [Circle, Triangle, Square][i];
                  return (
                    <button
                      key={shape}
                      className={token.shape === shape ? "active" : ""}
                      onClick={() => updateToken({ shape })}
                      aria-label={t("Use {v0}", { v0: t(shape) })}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            )}
            {token.role !== "equipment" && (
              <>
                <label className="toggle-row">
                  {t("Arms")}
                  <input
                    type="checkbox"
                    checked={token.arms ?? false}
                    onChange={(e) => updateToken({ arms: e.target.checked })}
                  />
                </label>
                <label className="toggle-row">
                  {t("Peto")}
                  <input
                    type="checkbox"
                    checked={token.peto?.enabled ?? false}
                    onChange={(e) =>
                      updateToken({
                        peto: {
                          enabled: e.target.checked,
                          color: token.peto?.color ?? "yellow",
                        },
                      })
                    }
                  />
                </label>
                {token.peto?.enabled && (
                  <div
                    className="peto-colors"
                    role="group"
                    aria-label={t("Peto color")}
                  >
                    {(
                      Object.keys(PETO_COLORS) as (keyof typeof PETO_COLORS)[]
                    ).map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={t("{v0} peto", {
                          v0: t(PETO_COLORS[color].label),
                        })}
                        title={t(PETO_COLORS[color].label)}
                        aria-pressed={token.peto?.color === color}
                        style={{ backgroundColor: PETO_COLORS[color].color }}
                        onClick={() =>
                          updateToken({ peto: { enabled: true, color } })
                        }
                      >
                        {token.peto?.color === color && <Check size={17} />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {playerKit(project, token) ? (
              <p className="muted">
                {t("Colors follow the team kit. Edit it under Player kits.")}
              </p>
            ) : (
              <label className="inline-label">
                {t("Color")}
                <input
                  type="color"
                  aria-label={t("Token color")}
                  value={token.color}
                  onChange={(e) => updateToken({ color: e.target.value })}
                />
              </label>
            )}
            <label className="inline-label">
              {t("Size")}
              <NumberStepper
                label={t("Token size")}
                min={4}
                max={50}
                value={token.size}
                onChange={(size) => updateToken({ size })}
              />
            </label>
          </>
        )}
        {arrow && (
          <div className="arrow-settings">
            <label className="inline-label">
              {t("Line color")}
              <input
                type="color"
                aria-label={t("Line color")}
                value={arrow.color}
                onChange={(e) =>
                  edit((d) => {
                    const current = d.keyframes[frameIndex].arrows.find(
                      (a) => a.id === selected,
                    );
                    if (current) current.color = e.target.value;
                  })
                }
              />
            </label>
            <label>
              {t("Arrowheads")}
              <select
                aria-label={t("Arrowheads")}
                value={arrow.heads ?? "end"}
                onChange={(e) =>
                  edit((d) => {
                    const current = d.keyframes[frameIndex].arrows.find(
                      (a) => a.id === selected,
                    );
                    if (current)
                      current.heads = e.target.value as typeof current.heads;
                  })
                }
              >
                <option value="end">{t("End only")}</option>
                <option value="start">{t("Start only")}</option>
                <option value="both">{t("Both ends")}</option>
                <option value="none">{t("None")}</option>
              </select>
            </label>
            <section className="bezier-editor" aria-label={t("Bézier points")}>
              <div className="bezier-heading">
                <h3>
                  {t("Bézier points")}{" "}
                  <span className="bezier-count">
                    {editableControls(arrow).length} / 12
                  </span>
                </h3>
                <button
                  className="bezier-add"
                  aria-label={t("Add Bézier point")}
                  disabled={arrowControls(arrow).length >= 12}
                  onClick={() =>
                    edit((d) => {
                      const frame = d.keyframes[frameIndex];
                      const index = frame.arrows.findIndex(
                        (a) => a.id === selected,
                      );
                      if (index !== -1)
                        frame.arrows[index] = addControl(frame.arrows[index]);
                    })
                  }
                >
                  <Plus size={16} /> {t("Add point")}
                </button>
              </div>
              <p className="muted">
                {arrowControls(arrow).length
                  ? t(
                      "Drag the numbered handles on the court to shape the curve.",
                    )
                  : t(
                      "Drag the center handle to bend the line, or add points for more control.",
                    )}
              </p>
              <ol
                className="bezier-points"
                aria-label={t("Bézier control points")}
              >
                {editableControls(arrow).map((_, index) => (
                  <li key={index}>
                    <span className="bezier-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>
                      {t("Point")} {index + 1}
                    </span>
                    <button
                      className="bezier-remove"
                      aria-label={t("Remove Bézier point {v0}", {
                        v0: index + 1,
                      })}
                      title={
                        arrowControls(arrow).length
                          ? t("Remove point {v0}", { v0: index + 1 })
                          : t("Drag the center handle to start a curve")
                      }
                      disabled={!arrowControls(arrow).length}
                      onClick={() =>
                        edit((d) => {
                          const frame = d.keyframes[frameIndex];
                          const at = frame.arrows.findIndex(
                            (a) => a.id === selected,
                          );
                          if (at !== -1)
                            frame.arrows[at] = withControls(
                              frame.arrows[at],
                              editableControls(frame.arrows[at]).filter(
                                (_, i) => i !== index,
                              ),
                            );
                        })
                      }
                    >
                      <X size={17} />
                    </button>
                  </li>
                ))}
              </ol>
              <button
                className="bezier-reset"
                disabled={!arrowControls(arrow).length}
                onClick={() =>
                  edit((d) => {
                    const frame = d.keyframes[frameIndex];
                    const at = frame.arrows.findIndex((a) => a.id === selected);
                    if (at !== -1)
                      frame.arrows[at] = withControls(frame.arrows[at], []);
                  })
                }
              >
                <RotateCcw size={15} /> {t("Straighten line")}
              </button>
            </section>
          </div>
        )}
        {token && (
          <>
            <label className="inline-label">
              {t("Rotation")}
              <NumberStepper
                label={t("Object rotation")}
                min={0}
                max={359}
                value={((Math.round(tokenRotation(token)) % 360) + 360) % 360}
                onChange={(rotation) => updateToken({ rotation })}
              />
              <span>°</span>
            </label>
            <p className="muted">
              {t("Drag the round handle to rotate. Hold Shift to snap to 15°.")}
            </p>
          </>
        )}
      </div>
    </>
  );
}
