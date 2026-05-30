import { useEffect, useRef } from "react";

/** Global keyboard actions. App supplies these; identities may change every
 *  render (they close over current state) — the hook always calls the latest. */
export interface KeyboardHandlers {
  onArrowDown: () => void;
  onArrowUp: () => void;
  onTogglePlayPause: () => void;
  onReplay: () => void;
  onFocusSearch: () => void;
  onEscape: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  );
}

/**
 * Registers one window-level keydown listener for the whole app so the keyboard
 * works without clicking into anything. The listener is bound once; it reads the
 * latest handlers through a ref to avoid the classic stale-closure bug where
 * arrow keys "stop working after the first move".
 */
export function useKeyboard(handlers: KeyboardHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const typing = isTypingTarget(e.target);

      // "/" jumps to the search box — but not while already typing in a field.
      if (e.key === "/" && !typing) {
        e.preventDefault();
        h.onFocusSearch();
        return;
      }

      // Esc works everywhere: clear/leave search and return to the list.
      if (e.key === "Escape") {
        e.preventDefault();
        h.onEscape();
        return;
      }

      // Inside the search box, let every other key type normally.
      if (typing) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault(); // stop the list/page from scrolling on its own
          h.onArrowDown();
          break;
        case "ArrowUp":
          e.preventDefault();
          h.onArrowUp();
          break;
        case " ": // Space toggles play/pause without moving the selection
          e.preventDefault(); // stop the page from scrolling
          h.onTogglePlayPause();
          break;
        case "Enter":
          e.preventDefault();
          h.onReplay();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
