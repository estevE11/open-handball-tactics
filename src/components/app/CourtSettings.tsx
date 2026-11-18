import { useTranslation } from "../../lib/i18n";
import type { CourtConfig } from "../../types/project";

// The same controls edit workspace defaults and a drill's independent settings.
export function CourtSettings({
  config,
  onChange,
}: {
  config: CourtConfig;
  onChange: (config: CourtConfig) => void;
}) {
  const t = useTranslation();
  function change(patch: Partial<CourtConfig>) {
    onChange({ ...structuredClone(config), ...patch });
  }
  return (
    <div className="court-settings">
      <label>
        {t("Template")}
        <select
          value={config.type}
          onChange={(e) =>
            change({
              type: e.target.value as CourtConfig["type"],
              dimensions: {
                width: 20,
                height: e.target.value === "full" ? 40 : 20,
              },
              halfCourtDepth:
                e.target.value === "half"
                  ? (config.halfCourtDepth ?? "20")
                  : config.halfCourtDepth,
            })
          }
        >
          <option value="half">{t("Half court · 20 × 20 m")}</option>
          <option value="full">{t("Full court · 40 × 20 m")}</option>
          <option value="custom_box">{t("Custom practice area")}</option>
        </select>
      </label>
      {config.type === "half" && (
        <>
          <label>
            {t("Court size")}
            <select
              value={config.halfCourtDepth ?? "20"}
              onChange={(e) => {
                const halfCourtDepth = e.target.value as "16" | "20";
                change({
                  halfCourtDepth,
                  dimensions: { width: 20, height: Number(halfCourtDepth) },
                });
              }}
            >
              <option value="20">{t("20 × 20 m")}</option>
              <option value="16">{t("20 × 16 m · compact")}</option>
            </select>
          </label>
          <label>
            {t("Goal position")}
            <select
              value={config.halfCourtEnd ?? "top"}
              onChange={(e) =>
                change({ halfCourtEnd: e.target.value as "top" | "bottom" })
              }
            >
              <option value="top">{t("Top · attacking view")}</option>
              <option value="bottom">{t("Bottom · defending view")}</option>
            </select>
          </label>
        </>
      )}
      {config.type === "custom_box" && (
        <div className="two-cols">
          {(["width", "height"] as const).map((axis) => (
            <label key={axis}>
              {t(axis)} {t("(m)")}
              <input
                type="number"
                min="10"
                max="100"
                value={config.dimensions[axis]}
                onChange={(e) => {
                  if (Number.isFinite(e.target.valueAsNumber))
                    change({
                      dimensions: {
                        ...config.dimensions,
                        [axis]: Math.max(
                          10,
                          Math.min(100, e.target.valueAsNumber),
                        ),
                      },
                    });
                }}
              />
            </label>
          ))}
        </div>
      )}
      <div className="color-row">
        {(["floor", "area", "lines"] as const).map((key) => (
          <label key={key}>
            <input
              type="color"
              aria-label={t("Court {v0} color", { v0: t(key) })}
              value={config.themeColors[key]}
              onChange={(e) =>
                change({
                  themeColors: { ...config.themeColors, [key]: e.target.value },
                })
              }
            />
            <span>{t(key)}</span>
          </label>
        ))}
      </div>
      <div className="background-setting">
        <label>
          {t("Canvas background")}
          <select
            aria-label={t("Canvas background")}
            value={config.background === "floor" ? "floor" : "custom"}
            onChange={(e) =>
              change({
                background:
                  e.target.value === "floor"
                    ? "floor"
                    : config.background === "floor"
                      ? config.themeColors.floor
                      : config.background,
              })
            }
          >
            <option value="floor">{t("Same as floor")}</option>
            <option value="custom">{t("Custom color")}</option>
          </select>
        </label>
        {config.background !== "floor" && (
          <label>
            <input
              type="color"
              aria-label={t("Canvas background color")}
              value={config.background}
              onChange={(e) => change({ background: e.target.value })}
            />
            <span>{t("background")}</span>
          </label>
        )}
      </div>
      <label className="inline-label">
        {t("Line weight")}
        <input
          type="range"
          aria-label={t("Court line weight")}
          min="1"
          max="5"
          step=".5"
          value={config.lineWeight}
          onChange={(e) => change({ lineWeight: Number(e.target.value) })}
        />
      </label>
      <label className="inline-label">
        {t("Player scale")}
        <span className="scale-control">
          <input
            type="range"
            aria-label={t("Player scale")}
            min="0.5"
            max="2"
            step="0.05"
            value={config.playerScale ?? 1}
            onChange={(e) => change({ playerScale: Number(e.target.value) })}
          />
          <span>{Math.round((config.playerScale ?? 1) * 100)}%</span>
        </span>
      </label>
      {(["grid", "showLabels", "highlight"] as const).map((key, i) => (
        <label className="toggle-row" key={key}>
          {t(["Show grid", "Player labels", "Highlight key lines"][i])}
          <input
            type="checkbox"
            checked={config[key] ?? false}
            onChange={(e) => change({ [key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  );
}
