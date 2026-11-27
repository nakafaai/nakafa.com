import { useCycleClock } from "@repo/design-system/components/contents/simulation/clock";

/** How long one pass from the least value to the greatest takes, in seconds. */
const SWEEP_SECONDS = 9;

/**
 * Plays one parameter of a coordinate lab, the one its slider sets: the
 * card's play action runs it from its least value to its greatest in the
 * slider's own steps, rests there, and starts again. A `descending` sweep
 * runs from the greatest value down, as a step that shrinks towards a limit. Pause holds the value,
 * a drag of the slider takes over from wherever it stands, and Stop and Reset
 * return the first value. It draws nothing and stands inside the scene,
 * because the scene's frames pace it.
 */
export function ParameterSweep({
  descending = false,
  initial,
  max,
  min,
  onValue,
  step,
  value,
}: {
  readonly descending?: boolean;
  readonly initial: number;
  readonly max: number;
  readonly min: number;
  readonly onValue: (value: number) => void;
  readonly step: number;
  readonly value: number;
}) {
  const total = max - min;
  // How far a value has run along the sweep, from its start.
  const progress = (reading: number) =>
    descending ? max - reading : reading - min;

  useCycleClock({
    initial: progress(initial),
    // A slider value is a multiple of its step, so the sum sheds its float error.
    onValue: (next) =>
      onValue(Math.round((descending ? max - next : min + next) / step) * step),
    rate: total / SWEEP_SECONDS,
    steps: Math.round(total / step),
    total,
    value: progress(value),
  });

  return null;
}
