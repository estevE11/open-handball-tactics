import {
  Circle,
  Triangle,
  Square,
  ImagePlus,
  Trash2,
  Check,
} from "lucide-react";
import { useRef, useState } from "react";
import { PETO_COLORS } from "../../types/peto";
import { PlayerKits } from "../kits/PlayerKits";
import { playerKit } from "../../lib/kits";
import { CourtSettings } from "./CourtSettings";
import { usePreferencesStore } from "../../store/preferencesStore";
import {
  addControl,
  arrowControls,
  editableControls,
  withControls,
} from "../../lib/arrowGeometry";
import { tokenRotation } from "../../lib/projectCompatibility";
import { fitProjectToCourt, courtSize } from "../../lib/courtGeometry";
import {
  defenses,
  offenses,
  formation,
  type Defense,
  type Offense,
} from "../../lib/formations";
import { useProjectStore } from "../../store/projectStore";
import type {
  CourtConfig,
  Point,
  StoredAsset,
  TacticalToken,
} from "../../types/project";

export function Inspector({
  assets,
  urls,
  upload,
  addAsset,
  removeAsset,
}: {
  assets: StoredAsset[];
  urls: Record<string, string>;
  upload: (file: File) => void;
  addAsset: (id: string, p: Point) => void;
  removeAsset: (id: string) => void;
}) {
  const { project, frameIndex, edit, selected } = useProjectStore();
  const file = useRef<HTMLInputElement>(null);
  const [defaultsResult, setDefaultsResult] = useState<{
    config: CourtConfig;
    error: string | null;
  } | null>(null);
  if (!project) return null;
  const config = project.courtConfig;
  const token = project.keyframes[frameIndex].tokens.find(
    (t) => t.id === selected,
  );
  const arrow = project.keyframes[frameIndex].arrows.find(
    (a) => a.id === selected,
  );
  function updateToken(patch: Partial<TacticalToken>) {
    edit((d) => {
      const t = d.keyframes[frameIndex].tokens.find((t) => t.id === selected);
      if (t) Object.assign(t, patch);
    });
  }
  function preset(role: "defender" | "attacker", system: Defense | Offense) {
    edit((d) => {
      const frame = d.keyframes[frameIndex];
      frame.tokens = [
        ...frame.tokens.filter((t) => t.role !== role),
        ...formation(role, system).map((token) => ({
          ...token,
          position:
            config.type === "custom_box"
              ? {
                  x: (token.position.x * courtSize(config).width) / 400,
                  y: (token.position.y * courtSize(config).height) / 400,
                }
              : token.position,
        })),
      ];
    });
  }
  return (
    <aside className="inspector">
      <div className="panel-title">
        Board settings <span className="tiny-label">LIVE</span>
      </div>
      {(token || arrow) && (
        <section className="inspector-section selected-panel">
          <h3>Selected {token ? token.role : "trajectory"}</h3>
          {token && (
            <>
              <label>
                Label
                <input
                  aria-label="Token label"
                  maxLength={80}
                  value={token.label}
                  onChange={(e) => updateToken({ label: e.target.value })}
                />
              </label>
              {!token.equipment && (
                <div className="shape-options">
                  {(["circle", "triangle", "square"] as const).map(
                    (shape, i) => {
                      const Icon = [Circle, Triangle, Square][i];
                      return (
                        <button
                          key={shape}
                          className={token.shape === shape ? "active" : ""}
                          onClick={() => updateToken({ shape })}
                          aria-label={`Use ${shape}`}
                        >
                          <Icon size={16} />
                        </button>
                      );
                    },
                  )}
                </div>
              )}
              {token.role !== "equipment" && (
                <>
                  <label className="toggle-row">
                    Peto
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
                      aria-label="Peto color"
                    >
                      {(
                        Object.keys(PETO_COLORS) as (keyof typeof PETO_COLORS)[]
                      ).map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`${PETO_COLORS[color].label} peto`}
                          title={PETO_COLORS[color].label}
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
                  Colors follow the team kit. Edit it under Player kits.
                </p>
              ) : (
                <label className="inline-label">
                  Color
                  <input
                    type="color"
                    aria-label="Token color"
                    value={token.color}
                    onChange={(e) => updateToken({ color: e.target.value })}
                  />
                </label>
              )}
              <label className="inline-label">
                Size
                <input
                  type="range"
                  aria-label="Token size"
                  min="4"
                  max="50"
                  value={token.size}
                  onChange={(e) =>
                    updateToken({ size: Number(e.target.value) })
                  }
                />
              </label>
            </>
          )}
          {arrow && (
            <div className="arrow-settings">
              <label className="inline-label">
                Line color
                <input
                  type="color"
                  aria-label="Line color"
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
                Arrowheads
                <select
                  aria-label="Arrowheads"
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
                  <option value="end">End only</option>
                  <option value="start">Start only</option>
                  <option value="both">Both ends</option>
                  <option value="none">None</option>
                </select>
              </label>
              <p className="muted">
                Drag the line to move it. Blue endpoints change its reach;
                numbered handles shape the curve.
              </p>
              <button
                className="text-button"
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
                + Add Bézier point
              </button>
              <div className="bezier-points">
                {editableControls(arrow).map((_, index) => (
                  <button
                    key={index}
                    className="text-button"
                    aria-label={`Remove Bézier point ${index + 1}`}
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
                    Point {index + 1} ×
                  </button>
                ))}
              </div>
            </div>
          )}
          {token && (
            <>
              <label className="inline-label">
                Rotation
                <input
                  className="rotation-input"
                  type="number"
                  aria-label="Object rotation"
                  min="0"
                  max="360"
                  step="5"
                  value={Math.round(((tokenRotation(token) % 360) + 360) % 360)}
                  onChange={(e) => {
                    if (Number.isFinite(e.target.valueAsNumber))
                      updateToken({
                        rotation: ((e.target.valueAsNumber % 360) + 360) % 360,
                      });
                  }}
                />
                <span>°</span>
              </label>
              <p className="muted">
                Drag the round handle to rotate. Hold Shift to snap to 15°.
              </p>
            </>
          )}
          <button
            className="text-button danger"
            onClick={() =>
              edit((d) => {
                const f = d.keyframes[frameIndex];
                f.tokens = f.tokens.filter((t) => t.id !== selected);
                f.arrows = f.arrows.filter((a) => a.id !== selected);
                const used = new Set(
                  d.keyframes.flatMap((f) => f.tokens.map((t) => t.assetId)),
                );
                d.customAssets = d.customAssets.filter((a) => used.has(a.id));
              })
            }
          >
            <Trash2 size={14} /> Delete selection
          </button>
        </section>
      )}
      <section className="inspector-section">
        <h3>Court · this drill</h3>
        <CourtSettings
          config={config}
          onChange={(next) =>
            edit((d) => {
              d.courtConfig = next;
              fitProjectToCourt(d);
            })
          }
        />
        <div className="defaults-actions court-defaults-actions">
          <button
            className="text-button"
            onClick={() =>
              edit((d) => {
                d.courtConfig = structuredClone(
                  usePreferencesStore.getState().courtDefaults,
                );
                fitProjectToCourt(d);
              })
            }
          >
            Apply workspace defaults
          </button>
          <button
            className="text-button"
            title="Use this drill’s court settings as the defaults for new drills"
            onClick={() => {
              try {
                usePreferencesStore
                  .getState()
                  .setCourtDefaults(structuredClone(config));
                setDefaultsResult({ config, error: null });
              } catch (error) {
                setDefaultsResult({
                  config,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Could not save defaults.",
                });
              }
            }}
          >
            Save as defaults
          </button>
        </div>
        {defaultsResult?.config === config && (
          <p
            className={defaultsResult.error ? "dialog-error" : "muted"}
            role={defaultsResult.error ? "alert" : undefined}
            aria-live="polite"
          >
            {defaultsResult.error ?? "Workspace defaults saved."}
          </p>
        )}
      </section>
      <PlayerKits />
      <section className="inspector-section">
        <h3>Quick formations</h3>
        <p className="muted">Set your shape. Make it your own.</p>
        <div className="formation-label">
          <Triangle size={12} fill="#eaa958" color="#c88b41" /> Defense
        </div>
        <div className="preset-grid">
          {defenses.map((system) => (
            <button key={system} onClick={() => preset("defender", system)}>
              {system}
            </button>
          ))}
        </div>
        <div className="formation-label">
          <Circle size={12} fill="#4f8cba" color="#4f8cba" /> Offense
        </div>
        <div className="preset-grid">
          {offenses.map((system) => (
            <button key={system} onClick={() => preset("attacker", system)}>
              {system}
            </button>
          ))}
        </div>
      </section>
      <section className="inspector-section">
        <div className="section-heading">
          <h3>Your assets</h3>
          <button
            className="icon-button"
            aria-label="Upload image"
            onClick={() => file.current?.click()}
          >
            <ImagePlus size={16} />
          </button>
        </div>
        <input
          ref={file}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            if (e.target.files?.[0]) upload(e.target.files[0]);
            e.target.value = "";
          }}
        />
        {assets.length ? (
          <div className="assets">
            {assets.map((a) => (
              <div key={a.id} className="asset">
                <button
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("application/handball-asset", a.id)
                  }
                  onClick={() => addAsset(a.id, { x: 200, y: 330 })}
                  title={`Add ${a.name}`}
                  aria-label={`Add ${a.name}`}
                >
                  <img src={urls[a.id]} alt={a.name} />
                </button>
                <button
                  className="asset-delete"
                  onClick={() => removeAsset(a.id)}
                  aria-label={`Delete asset ${a.name}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            className="asset-upload"
            onClick={() => file.current?.click()}
          >
            <ImagePlus size={21} />
            <span>Bring your own images</span>
            <small>PNG, JPG, WebP, GIF · up to 10 MB</small>
          </button>
        )}
        {assets.length > 0 && (
          <p className="muted">Click or drag an image onto the court.</p>
        )}
      </section>
    </aside>
  );
}
