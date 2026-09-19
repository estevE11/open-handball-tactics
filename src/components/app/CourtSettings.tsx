import type { CourtConfig } from "../../types/project";

// The same controls edit workspace defaults and a drill's independent settings.
export function CourtSettings({
  config,
  onChange,
}: {
  config: CourtConfig;
  onChange: (config: CourtConfig) => void;
}) {
  function change(patch: Partial<CourtConfig>) {
    onChange({ ...structuredClone(config), ...patch });
  }
  return (
    <div className="court-settings">
      <label>
        Template
        <select
          value={config.type}
          onChange={(e) =>
            change({
              type: e.target.value as CourtConfig["type"],
              dimensions: {
                width: 20,
                height: e.target.value === "full" ? 40 : 20,
              },
            })
          }
        >
          <option value="half">Half court · 20 × 20 m</option>
          <option value="full">Full court · 40 × 20 m</option>
          <option value="custom_box">Custom practice area</option>
        </select>
      </label>
      {config.type === "half" && (
        <label>
          Goal position
          <select
            value={config.halfCourtEnd ?? "top"}
            onChange={(e) =>
              change({ halfCourtEnd: e.target.value as "top" | "bottom" })
            }
          >
            <option value="top">Top · attacking view</option>
            <option value="bottom">Bottom · defending view</option>
          </select>
        </label>
      )}
      {config.type === "custom_box" && (
        <div className="two-cols">
          {(["width", "height"] as const).map((axis) => (
            <label key={axis}>
              {axis} (m)
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
              aria-label={`Court ${key} color`}
              value={config.themeColors[key]}
              onChange={(e) =>
                change({
                  themeColors: { ...config.themeColors, [key]: e.target.value },
                })
              }
            />
            <span>{key}</span>
          </label>
        ))}
      </div>
      <label className="inline-label">
        Line weight
        <input
          type="range"
          aria-label="Court line weight"
          min="1"
          max="5"
          step=".5"
          value={config.lineWeight}
          onChange={(e) => change({ lineWeight: Number(e.target.value) })}
        />
      </label>
      <label className="inline-label">
        Player scale
        <span className="scale-control">
          <input
            type="range"
            aria-label="Player scale"
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
          {["Show grid", "Player labels", "Highlight key lines"][i]}
          <input
            type="checkbox"
            checked={config[key]}
            onChange={(e) => change({ [key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  );
}
