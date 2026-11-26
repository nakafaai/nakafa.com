import { useThree } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { useEffect, useLayoutEffect, useRef } from "react";

/** How long a finished run rests on its last frame before it starts again. */
const HOLD = 1.6;

/**
 * The clock of one looping simulation run from `start` to `end` seconds.
 *
 * Before the learner presses Play, and whenever the run's inputs change while
 * it is paused, the clock stands at `end`, so the still frame shows the
 * outcome: where the car stopped, how long the marks are. Playing runs from
 * `start`, rests on the end, and loops. Stopping rewinds cleanly to `start`
 * and stays paused until Play is pressed again.
 */
export function useTimeline(start: number, end: number) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const time = useRef(end);
  const shownPlaying = useRef(false);

  useLayoutEffect(() => {
    time.current = shownPlaying.current ? start : end;
    invalidate();
  }, [end, invalidate, start]);

  useEffect(() => {
    if (playing) {
      invalidate();
    }
  }, [invalidate, playing]);

  useVisualStop(() => {
    shownPlaying.current = false;
    time.current = start;
    invalidate();
  });

  useVisualReset(() => {
    time.current = playing ? start : end;
    invalidate();
  });

  const advance = (delta: number) => {
    if (!playing) {
      shownPlaying.current = false;
      return time.current;
    }
    if (!shownPlaying.current && time.current >= end) {
      time.current = start;
    }
    shownPlaying.current = true;
    time.current += simulationStep(delta);
    if (time.current > end + HOLD) {
      time.current = start;
    }
    return Math.min(time.current, end);
  };

  return { advance, playing };
}
