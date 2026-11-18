import { useTranslation } from "../../lib/i18n";
import { Circle, Triangle, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { PlayerKits } from "../kits/PlayerKits";
import { CourtSettings } from "./CourtSettings";
import { usePreferencesStore } from "../../store/preferencesStore";
import { fitProjectToCourt, courtSize } from "../../lib/courtGeometry";
import {
  defenses,
  offenses,
  formation,
  type Defense,
  type Offense,
} from "../../lib/formations";
import { useProjectStore } from "../../store/projectStore";
import type { CourtConfig, Point, StoredAsset } from "../../types/project";

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
  const t = useTranslation();
  const { project, frameIndex, edit } = useProjectStore();
  const file = useRef<HTMLInputElement>(null);
  const [defaultsResult, setDefaultsResult] = useState<{
    config: CourtConfig;
    error: string | null;
  } | null>(null);
  if (!project) return null;
  const config = project.courtConfig;
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
        {t("Tactics settings")} <span className="tiny-label">{t("LIVE")}</span>
      </div>
      <section className="inspector-section court-panel">
        <h3>{t("Court · this drill")}</h3>
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
            {t("Apply workspace defaults")}
          </button>
          <button
            className="text-button"
            title={t(
              "Use this drill’s court settings as the defaults for new drills",
            )}
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
            {t("Save as defaults")}
          </button>
        </div>
        {defaultsResult?.config === config && (
          <p
            className={defaultsResult.error ? "dialog-error" : "muted"}
            role={defaultsResult.error ? "alert" : undefined}
            aria-live="polite"
          >
            {t(defaultsResult.error ?? "Workspace defaults saved.")}
          </p>
        )}
      </section>
      <PlayerKits />
      <section className="inspector-section">
        <h3>{t("Quick formations")}</h3>
        <p className="muted">{t("Set your shape. Make it your own.")}</p>
        <div className="formation-label">
          <Triangle size={12} fill="#eaa958" color="#c88b41" /> {t("Defense")}
        </div>
        <div className="preset-grid">
          {defenses.map((system) => (
            <button key={system} onClick={() => preset("defender", system)}>
              {system}
            </button>
          ))}
        </div>
        <div className="formation-label">
          <Circle size={12} fill="#4f8cba" color="#4f8cba" /> {t("Offense")}
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
          <h3>{t("Your assets")}</h3>
          <button
            className="icon-button"
            aria-label={t("Upload image")}
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
                  title={t("Add {v0}", { v0: a.name })}
                  aria-label={t("Add {v0}", { v0: a.name })}
                >
                  <img src={urls[a.id]} alt={a.name} />
                </button>
                <button
                  className="asset-delete"
                  onClick={() => removeAsset(a.id)}
                  aria-label={t("Delete asset {v0}", { v0: a.name })}
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
            <span>{t("Bring your own images")}</span>
            <small>{t("PNG, JPG, WebP, GIF · up to 10 MB")}</small>
          </button>
        )}
        {assets.length > 0 && (
          <p className="muted">{t("Click or drag an image onto the court.")}</p>
        )}
      </section>
    </aside>
  );
}
