import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { usePreferencesStore } from "../../store/preferencesStore";

export function ThemeToggle({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const dark = useTheme();
  return (
    <button
      className="icon-button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        try {
          usePreferencesStore.getState().setTheme(dark ? "light" : "dark");
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
    </button>
  );
}
