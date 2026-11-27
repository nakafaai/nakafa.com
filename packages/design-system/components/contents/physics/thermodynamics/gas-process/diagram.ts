import type {
  EndRange,
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  endQuantity,
  stateAlong,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { Array as Arr, Schema } from "effect";

/**
 * The p-V diagram under the cylinder: its axes from zero, the path of a
 * process as far as a play has come, the isotherms, and the end a press on
 * the plot sets.
 */

/** One axis from zero: where it ends and the step between its marks. */
const AxisSchema = Schema.Struct({
  maximum: Schema.Finite,
  step: Schema.Finite,
});
export type Axis = typeof AxisSchema.Type;

/** Both axes of the diagram. */
const AxesSchema = Schema.Struct({ pressure: AxisSchema, volume: AxisSchema });
export type Axes = typeof AxesSchema.Type;

/** A place on the plot, as shares of its width and its height from the origin. */
const SpotSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
type Spot = typeof SpotSchema.Type;

/** How many steps the path and the isotherms are drawn in. */
export const SAMPLES = 48;

/** How far an axis reaches past the largest value it must hold. */
const HEADROOM = 1.06;

/** How many steps the learner can set an end in across its range, about. */
const END_STEPS = 50;

/** The step of 1, 2 or 5 times a power of ten at or just above `raw`. */
function niceStep(raw: number) {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const share = raw / magnitude;
  if (share <= 1) {
    return magnitude;
  }
  if (share <= 2) {
    return 2 * magnitude;
  }
  return (share <= 5 ? 5 : 10) * magnitude;
}

/** A value rounded clear of the float error that steps of a tenth leave. */
function tidy(value: number) {
  return Number(value.toPrecision(12));
}

/** An axis from zero that holds `largest` with a little room, in about `steps` steps. */
function axisFor(largest: number, steps: number): Axis {
  const step = niceStep((largest * HEADROOM) / steps);
  return { maximum: tidy(Math.ceil((largest * HEADROOM) / step) * step), step };
}

/** Both axes of a diagram that holds every state, from zero, each in about `steps` steps. */
export function axesFor(states: readonly GasState[], steps: number): Axes {
  const most = (read: (state: GasState) => number) =>
    Arr.reduce(states, 0, (largest, state) => Math.max(largest, read(state)));
  return {
    pressure: axisFor(
      most((state) => state.pressure),
      steps
    ),
    volume: axisFor(
      most((state) => state.volume),
      steps
    ),
  };
}

/** The values an axis marks, from zero to its end. */
export function axisTicks(axis: Axis) {
  return Arr.makeBy(Math.round(axis.maximum / axis.step) + 1, (index) =>
    tidy(index * axis.step)
  );
}

/** The step the learner sets an end in: about a fiftieth of its range, on a 1, 2 or 5. */
export function endStep(range: EndRange) {
  return niceStep((range.max - range.min) / END_STEPS);
}

/** An end held in its range, on its step. */
export function settleEnd(range: EndRange, value: number) {
  const step = endStep(range);
  const snapped = tidy(Math.round(value / step) * step);
  return Math.min(range.max, Math.max(range.min, snapped));
}

/**
 * The end a press at `spot` on the plot sets: the volume across from it, or
 * for an isochoric process the pressure up from it, held in the range.
 */
export function endAt(
  process: GasProcess,
  range: EndRange,
  axes: Axes,
  spot: Spot
) {
  const value =
    endQuantity(process) === "volume"
      ? spot.x * axes.volume.maximum
      : spot.y * axes.pressure.maximum;
  return settleEnd(range, value);
}

/**
 * The path from `start` toward `end`, as far as `share` of the way, in
 * `count` even steps of the end quantity: `count` + 1 states.
 */
export function pathStates(
  process: GasProcess,
  ends: { readonly end: GasState; readonly start: GasState },
  gamma: number,
  count: number,
  share: number
) {
  return Arr.makeBy(count + 1, (index) =>
    stateAlong(process, ends.start, ends.end, gamma, (index / count) * share)
  );
}

/**
 * The isotherm through a state, where p V keeps its value, as `count` + 1
 * states from where it comes in at the top of the plot to its right edge;
 * none when it passes above the plot.
 */
export function isothermStates(
  state: GasState,
  axes: Axes,
  count: number
): readonly GasState[] {
  const product = state.pressure * state.volume;
  const from = product / axes.pressure.maximum;
  const to = axes.volume.maximum;
  if (from >= to) {
    return [];
  }
  return Arr.makeBy(count + 1, (index) => {
    const volume = from * (to / from) ** (index / count);
    return {
      pressure: product / volume,
      temperature: state.temperature,
      volume,
    };
  });
}
