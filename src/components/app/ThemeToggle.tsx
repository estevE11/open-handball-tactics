import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { usePreferencesStore } from "../../store/preferencesStore";

export function ThemeToggle({
  onError,
  labelled = false,
  onToggle,
}: {
  onError: (message: string) => void;
  labelled?: boolean;
  onToggle?: () => void;
}) {
  const dark = useTheme();
  return (
    <button
      className={
        labelled
          ? "theme-toggle workspace-theme-toggle"
          : "icon-button theme-toggle"
      }
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        try {
          usePreferencesStore.getState().setTheme(dark ? "light" : "dark");
          onToggle?.();
        } catch (error) {
          onError(
            error instanceof Error
              ? error.message
              : "Could not save appearance.",
          );
        }
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {labelled && <span>{dark ? "Light appearance" : "Dark appearance"}</span>}
    </button>
  );
}
