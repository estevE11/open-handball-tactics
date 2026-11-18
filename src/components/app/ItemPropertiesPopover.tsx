import { useTranslation } from "../../lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ItemProperties } from "./ItemProperties";

export type ItemAnchor = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

export function ItemPropertiesPopover({
  anchor,
  onClose,
}: {
  anchor: ItemAnchor;
  onClose: () => void;
}) {
  const t = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  useLayoutEffect(() => {
    const element = ref.current!;
    function place() {
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft ?? 0;
      const y = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      element.style.maxHeight = `${height - 16}px`;
      element.style.maxWidth = `${width - 16}px`;
      let bounds = element.getBoundingClientRect();
      let left = anchor.right + 12;
      let top = anchor.top;
      if (left + bounds.width > x + width - 8) {
        left = anchor.left - bounds.width - 12;
        if (left < x + 8) {
          // On narrow screens, leave the item exposed so it can still be dragged.
          const above = anchor.top - y - 20;
          const below = y + height - anchor.bottom - 20;
          const space = Math.max(above, below);
          if (space >= 180) element.style.maxHeight = `${space}px`;
          bounds = element.getBoundingClientRect();
          left = anchor.left;
          top =
            above > below
              ? anchor.top - bounds.height - 12
              : anchor.bottom + 12;
        }
      }
      setPosition({
        left: Math.max(x + 8, Math.min(x + width - bounds.width - 8, left)),
        top: Math.max(y + 8, Math.min(y + height - bounds.height - 8, top)),
      });
    }
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [anchor]);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    function outside(event: Event) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
      document
        .getElementById("tactical-canvas")
        ?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", outside, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", outside, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, [onClose]);
  return createPortal(
    <dialog
      open
      ref={ref}
      tabIndex={-1}
      aria-label={t("Item properties")}
      aria-modal="false"
      className="item-properties-popover"
      style={position}
    >
      <ItemProperties onClose={onClose} />
    </dialog>,
    document.body,
  );
}
