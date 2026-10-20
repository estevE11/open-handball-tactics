import { useCallback, useEffect, useRef, useState } from "react";

export function useFullscreenWorkspace() {
  const [fullscreen, setFullscreen] = useState(false);
  const nativeFullscreen = useRef(false);
  const requested = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const restore = useCallback(() => {
    requested.current = false;
    setFullscreen(false);
    requestAnimationFrame(() =>
      returnFocus.current?.focus({ preventScroll: true }),
    );
  }, []);

  const exitFullscreen = useCallback(() => {
    restore();
    if (document.fullscreenElement === document.documentElement) {
      nativeFullscreen.current = false;
      void document.exitFullscreen().catch(() => {});
    }
  }, [restore]);

  function enterFullscreen() {
    requested.current = true;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setFullscreen(true);
    // The viewport layout also works when native fullscreen is unavailable or
    // denied (for example, on a phone or inside an embedded browser).
    if (
      document.fullscreenEnabled &&
      !document.fullscreenElement &&
      typeof document.documentElement.requestFullscreen === "function"
    ) {
      // fullscreenchange can arrive after a quick browser-initiated exit.
      nativeFullscreen.current = true;
      void document.documentElement
        .requestFullscreen()
        .then(() => {
          if (
            !requested.current &&
            document.fullscreenElement === document.documentElement
          )
            void document.exitFullscreen().catch(() => {});
        })
        .catch(() => {
          nativeFullscreen.current = false;
        });
    }
  }

  useEffect(() => {
    const change = () => {
      if (document.fullscreenElement === document.documentElement)
        nativeFullscreen.current = true;
      else if (nativeFullscreen.current) {
        nativeFullscreen.current = false;
        restore();
      }
    };
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, [restore]);

  useEffect(() => {
    if (!fullscreen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]"))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      exitFullscreen();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [fullscreen, exitFullscreen]);

  return { fullscreen, enterFullscreen, exitFullscreen };
}
