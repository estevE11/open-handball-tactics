import { expect, it } from "vitest";
import {
  readPreferences,
  savePreferences,
  PREFERENCES_KEY,
} from "./preferences";
import { DEFAULT_COURT, newProject } from "./projectDefaults";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  } as Storage;
}
it("persists every court default and gives each drill its own settings", () => {
  const local = storage();
  const config = {
    ...structuredClone(DEFAULT_COURT),
    type: "custom_box" as const,
    dimensions: { width: 12, height: 14 },
    playerScale: 1.5,
    lineWeight: 3,
    grid: true,
    highlight: true,
    showLabels: false,
    themeColors: { floor: "#aabbcc", area: "#556677", lines: "#112233" },
  };
  savePreferences({ courtDefaults: config, theme: "system" }, local);
  const restored = readPreferences(local);
  expect(restored.courtDefaults).toEqual(config);
  const first = newProject("First", null, restored.courtDefaults);
  const next = newProject("Next", null, restored.courtDefaults);
  first.courtConfig.themeColors.floor = "#ff0000";
  first.courtConfig.playerScale = 0.5;
  expect(next.courtConfig).toEqual(config);
  expect(readPreferences(local).courtDefaults).toEqual(config);
  expect(
    first.keyframes[0].tokens.every(
      (token) => token.position.x <= 240 && token.position.y <= 280,
    ),
  ).toBe(true);
});
it("falls back safely from corrupt preferences and reports failed writes", () => {
  const local = storage();
  local.setItem(PREFERENCES_KEY, "invalid");
  expect(readPreferences(local).courtDefaults).toEqual(DEFAULT_COURT);
  local.setItem = () => {
    throw new Error("quota");
  };
  expect(() =>
    savePreferences({ courtDefaults: DEFAULT_COURT, theme: "system" }, local),
  ).toThrow("Could not save");
});
