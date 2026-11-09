import { useDocumentVisibility, useReducedMotion } from "@mantine/hooks";
import { useThree } from "@react-three/fiber";
import { useStableMutableValue } from "@repo/design-system/hooks/stable";
import { createFramePace } from "@repo/design-system/lib/pace";
import { useEffect, useRef } from "react";

/** The ambient life's frame rate at most, a frame every 33 milliseconds. */
const FRAME_GAP = 1000 / 30;

/**
 * Keeps the water and the animals moving: after each frame it asks for the
 * next one at 30 frames a second at most, kept to its share of the main thread
 * by `createFramePace`. It stops while the page is hidden and starts again when
 * the page shows, and with reduced motion the island draws once and holds its
 * pose (ADR 0042, D17). Returns what the frame calls once it is drawn.
 */
export function useAmbientLoop() {
  const invalidate = useThree((state) => state.invalidate);
  const calm = useReducedMotion();
  const visibility = useDocumentVisibility();
  const pace = useStableMutableValue(createFramePace);
  const timer = useRef(0);
  useEffect(() => {
    if (!calm && visibility === "visible") {
      invalidate();
    }
    return () => window.clearTimeout(timer.current);
  }, [calm, invalidate, visibility]);
  return (startedAt: number) => {
    pace.rest(startedAt, performance.now());
    window.clearTimeout(timer.current);
    if (calm || visibility !== "visible") {
      return;
    }
    const wait = () => {
      timer.current = window.setTimeout(() => {
        if (pace.isDue(performance.now())) {
          invalidate();
          return;
        }
        wait();
      }, FRAME_GAP);
    };
    wait();
  };
}
