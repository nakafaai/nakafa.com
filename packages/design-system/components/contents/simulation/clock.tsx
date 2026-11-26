import { useFrame, useThree } from "@react-three/fiber";
import type { CycleState } from "@repo/design-system/components/contents/simulation/cycle";
import {
  quantizeCycle,
  stepCycle,
} from "@repo/design-system/components/contents/simulation/cycle";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { useEffect, useEffectEvent, useRef } from "react";

/** Default pause at the end of a bounded progress loop, in seconds. */
export const DEFAULT_CYCLE_HOLD = 1.2;

/**
 * Delta-accumulated simulation clock that advances strictly while the
 * surrounding visual card is playing, freezes cleanly on Pause, and resets to
 * `initial` when the card's reset action fires.
 */
export function useSimulationClock(initial = 0) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const time = useRef(initial);

  useEffect(() => {
    if (playing) {
      invalidate();
    }
  }, [invalidate, playing]);

  useVisualStop(() => {
    time.current = initial;
    invalidate();
  });

  useVisualReset(() => {
    time.current = initial;
    invalidate();
  });

  const advance = (delta: number) => {
    if (playing) {
      time.current += simulationStep(delta);
    }
    return time.current;
  };

  return { advance, playing, time };
}

/** Wakes a demand-rendered canvas whenever `key` changes while paused. */
export function useInvalidateOnChange(key: unknown) {
  const invalidate = useThree((state) => state.invalidate);
  const previous = useRef(key);

  useEffect(() => {
    if (Object.is(previous.current, key)) {
      return;
    }
    previous.current = key;
    invalidate();
  }, [invalidate, key]);
}

/**
 * Bounded looping clock `[0, total]` synced with a toolbar slider. Scrubbing
 * updates the scene immediately while paused; playing advances smoothly through
 * `total`, holds cleanly at `total` for `holdSeconds` without ever overshooting
 * `total`, and loops back to `0`. Resetting the card restores `initial`.
 */
export function useCycleClock({
  holdSeconds = DEFAULT_CYCLE_HOLD,
  initial,
  onValue,
  rate,
  steps,
  total,
  value,
}: {
  readonly holdSeconds?: number;
  readonly initial?: number;
  readonly onValue: (value: number) => void;
  readonly rate: number;
  readonly steps: number;
  readonly total: number;
  readonly value: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const state = useRef<CycleState>({ hold: 0, value });
  const sent = useRef(value);
  const shownPlaying = useRef(false);
  const clock = useRef(value);
  const emit = useEffectEvent(onValue);

  useEffect(() => {
    if (value !== sent.current) {
      state.current = { hold: 0, value };
      clock.current = value;
      sent.current = value;
      invalidate();
    }
  }, [invalidate, value]);

  useEffect(() => {
    if (playing) {
      invalidate();
    }
  }, [invalidate, playing]);

  useVisualStop(() => {
    const start = initial ?? 0;
    shownPlaying.current = false;
    state.current = { hold: 0, value: start };
    clock.current = start;
    sent.current = start;
    onValue(start);
    invalidate();
  });

  useVisualReset(() => {
    const start = initial ?? 0;
    state.current = { hold: 0, value: start };
    clock.current = start;
    sent.current = start;
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      shownPlaying.current = false;
      clock.current = state.current.value;
      return;
    }
    // Starting Play from a parked end-of-cycle pose replays from 0 immediately.
    if (!shownPlaying.current && state.current.value >= total) {
      state.current = { hold: 0, value: 0 };
    }
    shownPlaying.current = true;
    state.current = stepCycle(state.current, {
      deltaSeconds: simulationStep(delta),
      holdSeconds,
      rate,
      total,
    });
    clock.current = state.current.value;
    const shown = quantizeCycle(state.current.value, total, steps);
    if (shown !== sent.current) {
      sent.current = shown;
      emit(shown);
    }
  });

  return clock;
}
