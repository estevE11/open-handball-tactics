import { useEffect, useSyncExternalStore } from "react";
import { usePreferencesStore } from "../store/preferencesStore";
import type { Preferences } from "../lib/preferences";

const query = "(prefers-color-scheme: dark)";
const systemIsDark = () => window.matchMedia(query).matches;
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function applyTheme(theme: Preferences["theme"]) {
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" || (theme === "system" && systemIsDark()),
  );
}
export function useTheme() {
  const theme = usePreferencesStore((state) => state.theme);
  const systemDark = useSyncExternalStore(subscribe, systemIsDark, () => false);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    applyTheme(theme);
  }, [theme, dark]);
  return dark;
}
