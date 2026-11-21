import { addAfterEffect, addEffect, useThree } from "@react-three/fiber";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { createFramePace } from "@repo/design-system/lib/pace";
import { useEffect } from "react";

/**
 * Drives a local simulation transition on a canvas that renders on demand,
 * such as a stain soak or slider easing while the card itself is paused. While
 * the card is playing, `ThreeCanvas` already drives paced frames at
 * `createFramePace()`, so this stays quiet to avoid duplicate rAF loops.
 */
export function SimulationTicker({ running }: { readonly running: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const cardPlaying = useVisualScene((state) => state.playing, false);
  const active = running && !cardPlaying;

  useEffect(() => {
    if (!active) {
      return;
    }
    const pace = createFramePace();
    let startedAt = 0;
    let waiting = false;
    let frame = 0;

    const wait = () => {
      if (pace.isDue(performance.now())) {
        waiting = false;
        invalidate();
        return;
      }
      frame = requestAnimationFrame(wait);
    };
    const removeStart = addEffect(() => {
      startedAt = performance.now();
    });
    const removeEnd = addAfterEffect(() => {
      pace.rest(startedAt);
      if (!waiting) {
        waiting = true;
        frame = requestAnimationFrame(wait);
      }
    });
    invalidate();

    return () => {
      removeStart();
      removeEnd();
      cancelAnimationFrame(frame);
    };
  }, [active, invalidate]);

  return null;
}

/**
 * The time a simulation advances in one drawn frame. A paced frame can come
 * a fifth of a second after the last on a slow phone, and a tab that was
 * hidden comes back seconds later, so the step is capped: a slow device
 * then runs the simulation in slow motion rather than skipping through it.
 */
export function simulationStep(delta: number) {
  return Math.min(delta, 0.1);
}
