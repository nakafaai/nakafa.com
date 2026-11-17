import { Array as Arr, Option } from "effect";
import { createStore } from "zustand";
import { combine } from "zustand/middleware";

/**
 * The value of every slider of one scene by its name. Moving a slider writes
 * here, and every formula that reads the name samples again.
 */
export function createParameterStore(values: Readonly<Record<string, number>>) {
  return createStore(
    combine({ values }, (set) => ({
      /** Moves one slider to a value its range allows. */
      move: (name: string, value: number) =>
        set((state) => ({ values: { ...state.values, [name]: value } })),
    }))
  );
}

/** One scene's slider store. */
export type ParameterStore = ReturnType<typeof createParameterStore>;

/** The most decimals a slider's value shows. */
const MOST_DIGITS = 4;

/** Whether a value is a whole number, within the rounding of a float. */
function isWhole(value: number) {
  return (
    Math.abs(value - Math.round(value)) < 1e-9 * Math.max(1, Math.abs(value))
  );
}

/**
 * The decimals a slider's value shows: as many as its step and its minimum
 * have, so every value it stops at reads exactly (0.75 on a step of 0.25),
 * and at most four for a step that never ends.
 */
export function sliderDigits({
  min,
  step,
}: {
  readonly min: number;
  readonly step: number;
}) {
  return Option.getOrElse(
    Arr.findFirst(
      Arr.range(0, MOST_DIGITS - 1),
      (digits) => isWhole(step * 10 ** digits) && isWhole(min * 10 ** digits)
    ),
    () => MOST_DIGITS
  );
}
