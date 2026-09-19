import { create } from "zustand";
import type { CourtConfig } from "../types/project";
import {
  readPreferences,
  savePreferences,
  type Preferences,
} from "../lib/preferences";

interface PreferencesState extends Preferences {
  setCourtDefaults: (defaults: CourtConfig) => void;
  setTheme: (theme: Preferences["theme"]) => void;
}
export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...readPreferences(),
  setCourtDefaults: (courtDefaults) => {
    const next = savePreferences({ courtDefaults, theme: get().theme });
    set(next);
  },
  setTheme: (theme) => {
    const next = savePreferences({ courtDefaults: get().courtDefaults, theme });
    set(next);
  },
}));
