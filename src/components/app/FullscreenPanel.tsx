import { useTranslation } from "../../lib/i18n";
import { useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";

const inward = {
  left: ChevronRight,
  right: ChevronLeft,
  top: ChevronDown,
  bottom: ChevronUp,
};
const outward = {
  left: ChevronLeft,
  right: ChevronRight,
  top: ChevronUp,
  bottom: ChevronDown,
};

export function FullscreenPanel({
  enabled,
  name,
  edge,
  children,
}: {
  enabled: boolean;
  name: "Tools" | "Properties";
  edge: keyof typeof inward;
  children: ReactNode;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(true);
  const showButton = useRef<HTMLButtonElement>(null);
  const hideButton = useRef<HTMLButtonElement>(null);
  if (!enabled) return children;
  const Show = inward[edge];
  const Hide = outward[edge];
  const id = `fullscreen-${name.toLowerCase()}`;

  function toggle(next: boolean) {
    setOpen(next);
    requestAnimationFrame(() =>
      (next ? hideButton : showButton).current?.focus({ preventScroll: true }),
    );
  }

  return (
    <div
      className={`fullscreen-panel fullscreen-${name.toLowerCase()} ${open ? "is-open" : "is-collapsed"}`}
      data-edge={edge}
    >
      <button
        ref={showButton}
        className="fullscreen-panel-handle"
        aria-label={t("Show {v0}", { v0: t(name.toLowerCase()) })}
        aria-expanded={open}
        aria-controls={id}
        hidden={open}
        title={t("Show {v0}", { v0: t(name.toLowerCase()) })}
        onClick={() => toggle(true)}
      >
        <Show size={18} />
      </button>
      <section
        id={id}
        className="fullscreen-panel-surface"
        aria-label={t("{v0} panel", { v0: t(name) })}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="fullscreen-panel-heading">
          <span>{t(name)}</span>
          <button
            ref={hideButton}
            className="icon-button"
            aria-label={t("Hide {v0}", { v0: t(name.toLowerCase()) })}
            aria-expanded={open}
            aria-controls={id}
            title={t("Hide {v0}", { v0: t(name.toLowerCase()) })}
            onClick={() => toggle(false)}
          >
            <Hide size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
