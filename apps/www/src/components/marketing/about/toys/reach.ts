import { useWindowEvent } from "@mantine/hooks";
import { useState, useSyncExternalStore } from "react";

/** Calls the listener at every scroll of the window, and returns the way to stop. */
function subscribeToScroll(onScroll: () => void) {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/** Whether the window is scrolled away from its top, as an earlier scroll leaves it. */
function isScrolled() {
  return window.scrollY > 0;
}

/** The server renders the page at its top, so every reader starts from the same HTML. */
function isScrolledOnServer() {
  return false;
}

/**
 * Tells whether the reader has acted on the page: scrolled it, moved the pointer
 * over it or touched it. The window keeps the offset of a scroll that came before
 * the page hydrated, so that scroll still counts. A pointer movement or a touch
 * that came before hydration leaves nothing to read.
 */
export function useReachedPage() {
  const [acted, setActed] = useState(false);
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    isScrolled,
    isScrolledOnServer
  );

  useWindowEvent("scroll", () => setActed(true), { passive: true });
  useWindowEvent("pointermove", () => setActed(true), { passive: true });
  useWindowEvent("touchstart", () => setActed(true), { passive: true });

  return acted || scrolled;
}
