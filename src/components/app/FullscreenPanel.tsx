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
        aria-label={`Show ${name.toLowerCase()}`}
        aria-expanded={open}
        aria-controls={id}
        hidden={open}
        title={`Show ${name.toLowerCase()}`}
        onClick={() => toggle(true)}
      >
        <Show size={18} />
      </button>
      <section
        id={id}
        className="fullscreen-panel-surface"
        aria-label={`${name} panel`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="fullscreen-panel-heading">
          <span>{name}</span>
          <button
            ref={hideButton}
            className="icon-button"
            aria-label={`Hide ${name.toLowerCase()}`}
            aria-expanded={open}
            aria-controls={id}
            title={`Hide ${name.toLowerCase()}`}
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
