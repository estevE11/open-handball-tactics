import { useTranslation } from "../../lib/i18n";
import { useEffect, useRef } from "react";
import { CircleHelp, HardDrive, MoreHorizontal, Settings2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelect } from "./LanguageSelect";

export function WorkspaceMenu({
  onPreferences,
  onHelp,
  onError,
  storageStatus,
}: {
  onPreferences: () => void;
  onHelp: () => void;
  onError: (message: string) => void;
  storageStatus: string;
}) {
  const t = useTranslation();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node))
        ref.current?.removeAttribute("open");
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !ref.current?.open) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, []);
  function choose(action: () => void) {
    if (ref.current) ref.current.open = false;
    action();
  }
  return (
    <details ref={ref} className="workspace-menu">
      <summary
        role="button"
        className="icon-button"
        aria-label={t("More actions")}
        title={t("More actions")}
      >
        <MoreHorizontal size={20} />
      </summary>
      <div
        className="workspace-menu-content"
        role="group"
        aria-label={t("Workspace actions")}
      >
        <LanguageSelect />
        <button
          aria-label={t("Workspace defaults")}
          onClick={() => choose(onPreferences)}
        >
          <Settings2 size={17} /> {t("Workspace defaults")}
        </button>
        <div className="workspace-menu-appearance">
          <ThemeToggle
            labelled
            onError={onError}
            onToggle={() => {
              if (ref.current) ref.current.open = false;
            }}
          />
        </div>
        <button onClick={() => choose(onHelp)}>
          <CircleHelp size={17} /> {t("Help")}
        </button>
        <div className="workspace-menu-status">
          <HardDrive size={15} /> {t(storageStatus)}
        </div>
      </div>
    </details>
  );
}
