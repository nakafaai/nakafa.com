import { MutableRef } from "effect";

/**
 * Builds the router's scroll restoration rule, once per router.
 *
 * The render that hydrates a page runs on a document the browser has already
 * placed: at the top, at its hash, where a reload or a return left it, or
 * wherever the reader scrolled while the page was still HTML. A static page
 * arrives long before its scripts, so a reader often scrolls first. After that
 * render TanStack Router scrolls to the top unless it saved a position, so the
 * rule lets it act only on a window the browser left at the top, where it
 * restores a saved position or keeps the top. Every later render follows a
 * navigation and restores or resets as usual. The server asks too, to decide
 * its inline restoration script, and keeps that script.
 */
export function makeScrollRestoration() {
  const hydrating = MutableRef.make(true);
  return () => {
    if (
      typeof window === "undefined" ||
      !MutableRef.getAndSet(hydrating, false)
    ) {
      return true;
    }
    return window.scrollY === 0;
  };
}
