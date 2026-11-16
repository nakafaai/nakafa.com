import { useFrame, useThree } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { useEffect, useRef } from "react";

/**
 * The clock of a lab whose card shows the time on a slider: it runs from 0 to
 * `total` while the card plays, at `perSecond` units a second, and loops. The
 * card hands the slider's value in as `elapsed` and takes the playing clock
 * back through `onElapsed`, rounded to `steps` steps of the run, so the card
 * re-renders a few times a second at most while the scene reads the exact
 * clock every frame.
 */
export function useRunClock({
  elapsed,
  onElapsed,
  perSecond,
  steps,
  total,
}: {
  readonly elapsed: number;
  readonly onElapsed: (value: number) => void;
  readonly perSecond: number;
  readonly steps: number;
  readonly total: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const clock = useRef(elapsed);
  const sent = useRef(elapsed);

  // A time the learner set on the slider moves the clock; a time the clock
  // sent while playing is already on it.
  useEffect(() => {
    if (elapsed !== sent.current) {
      clock.current = elapsed;
      sent.current = elapsed;
      invalidate();
    }
  }, [elapsed, invalidate]);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current =
      clock.current >= total
        ? 0
        : Math.min(total, clock.current + simulationStep(delta) * perSecond);
    const step = total / steps;
    const shown = Math.round(clock.current / step) * step;
    if (shown !== sent.current) {
      sent.current = shown;
      onElapsed(shown);
    }
    invalidate();
  });

  return clock;
}
