import { addAfterEffect, addEffect, useThree } from "@react-three/fiber";
import { createFramePace } from "@repo/design-system/lib/pace";
import { useEffect } from "react";

/**
 * Drives a simulation on a canvas that renders on demand. While `running`,
 * it asks for the next frame only once the last one has rested its share:
 * the pace measures what each frame cost, from the start of the frame loop
 * to the end of its render, and rests seven times as long (ADR 0039, D5).
 * A fast laptop still draws every display frame; a slow phone draws a few a
 * second and keeps the thread free for the reader. While stopped, the canvas
 * draws only when the camera moves.
 */
export function SimulationTicker({ running }: { readonly running: boolean }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!running) {
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
      pace.rest(startedAt, performance.now());
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
  }, [running, invalidate]);

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
