import { z } from "zod";
import { courtConfigSchema } from "../types/project";
import { DEFAULT_COURT } from "./projectDefaults";

const schema = z.object({
  courtDefaults: courtConfigSchema,
  theme: z.enum(["light", "dark", "system"]).default("system"),
});
export type Preferences = z.infer<typeof schema>;
export const PREFERENCES_KEY = "ohb.preferences.v1";
function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
export function readPreferences(storage = browserStorage()): Preferences {
  try {
    const value = storage?.getItem(PREFERENCES_KEY);
    if (value) return schema.parse(JSON.parse(value));
  } catch {
    /* Invalid/unavailable preferences never prevent opening the library. */
  }
  return { courtDefaults: structuredClone(DEFAULT_COURT), theme: "system" };
}
export function savePreferences(
  preferences: Preferences,
  storage = browserStorage(),
) {
  const valid = schema.parse(preferences);
  if (!storage) throw new Error("Browser preferences storage is unavailable.");
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(valid));
  } catch {
    throw new Error(
      "Could not save your workspace preferences. Check browser storage permissions and available space.",
    );
  }
  return valid;
}
