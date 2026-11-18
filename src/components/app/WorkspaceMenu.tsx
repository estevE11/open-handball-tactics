import { useEffect, useRef } from "react";
import {
  CircleHelp,
  Copy,
  HardDrive,
  MoreHorizontal,
  Settings2,
} from "lucide-react";

export function WorkspaceMenu({
  onDuplicate,
  onPreferences,
  onHelp,
  busy,
  storageStatus,
}: {
  onDuplicate?: () => void;
  onPreferences: () => void;
  onHelp: () => void;
  busy: boolean;
  storageStatus: string;
}) {
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
        aria-label="More actions"
        title="More actions"
      >
        <MoreHorizontal size={20} />
      </summary>
      <div
        className="workspace-menu-content"
        role="group"
        aria-label="Workspace actions"
      >
        {onDuplicate && (
          <>
            <button
              aria-label="Duplicate"
              disabled={busy}
              onClick={() => choose(onDuplicate)}
            >
              <Copy size={17} /> Duplicate drill
            </button>
            <hr />
          </>
        )}
        <button
          aria-label="Workspace defaults"
          onClick={() => choose(onPreferences)}
        >
          <Settings2 size={17} /> Workspace defaults
        </button>
        <button onClick={() => choose(onHelp)}>
          <CircleHelp size={17} /> Help
        </button>
        <div className="workspace-menu-status">
          <HardDrive size={15} /> {storageStatus}
        </div>
      </div>
    </details>
  );
}
