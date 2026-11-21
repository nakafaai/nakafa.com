import { useVisualScene } from "@repo/design-system/components/visual/card";
import { useEffect, useRef } from "react";

/**
 * Runs `onReset` whenever the surrounding visual card's Reset View action
 * increments the card's reset counter, keeping toolbar controls and simulation
 * clocks aligned with the reset camera.
 */
export function ViewReset({ onReset }: { readonly onReset: () => void }) {
  const view = useVisualScene((card) => card.view, 0);
  const seen = useRef(view);

  useEffect(() => {
    if (view === seen.current) {
      return;
    }
    seen.current = view;
    onReset();
  }, [onReset, view]);

  return null;
}
