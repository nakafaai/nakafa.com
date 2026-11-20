import { useEffect, useState } from "react";

/** The face a print uses until the page's own fonts have loaded. */
const FALLBACK = "system-ui, sans-serif";

/**
 * The typeface the tiles and the claim card are printed in: the page's own
 * sans-serif face once its fonts have loaded, and the system face before. A
 * canvas draws with whatever face is ready when it draws, so a texture that
 * depends on the returned face is drawn anew when the page's face arrives.
 */
export function usePrintFont() {
  const [ready, setReady] = useState(() => document.fonts.status === "loaded");

  useEffect(() => {
    if (ready) {
      return;
    }
    let live = true;
    document.fonts.ready.then(() => {
      if (live) {
        setReady(true);
      }
    });
    return () => {
      live = false;
    };
  }, [ready]);

  return ready ? getComputedStyle(document.body).fontFamily : FALLBACK;
}
