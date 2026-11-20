import type {
  EndRange,
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  endQuantity,
  stateAlong,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { Array as Arr, Option, Schema } from "effect";

/**
 * The p-V diagram on the board: its axes from zero, where a state lies on
 * the plot, the band under a path whose area is the work the gas does, the
 * isotherms, and the end a press on the plot sets. Places on the plot are in
 * metres from its origin, x across with the volume and y up with the
 * pressure.
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

/** The size of the plot on the board, in metres. */
const PlotSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
});
type Plot = typeof PlotSchema.Type;

/** A place on the plot, in metres from its origin. */
const SpotSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
type Spot = typeof SpotSchema.Type;

/** How many steps the path, its band and the isotherms are drawn in. */
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

/** The values an axis marks, from its first step to its end: zero is the origin's own mark. */
export function axisTicks(axis: Axis) {
  return Arr.makeBy(Math.round(axis.maximum / axis.step), (index) =>
    tidy((index + 1) * axis.step)
  );
}

/** Where a pressure and volume lie on the plot. */
export function plotPoint(
  point: { readonly pressure: number; readonly volume: number },
  axes: Axes,
  plot: Plot
): Spot {
  return {
    x: (point.volume / axes.volume.maximum) * plot.width,
    y: (point.pressure / axes.pressure.maximum) * plot.height,
  };
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
  plot: Plot,
  spot: Spot
) {
  const value =
    endQuantity(process) === "volume"
      ? (spot.x / plot.width) * axes.volume.maximum
      : (spot.y / plot.height) * axes.pressure.maximum;
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
 * The band between a path and the volume axis, whose area is the work: for
 * each state a vertex on the path and one under it on the axis, three
 * numbers each.
 */
export function bandPositions(
  states: readonly GasState[],
  axes: Axes,
  plot: Plot
) {
  const positions = new Float32Array(states.length * 6);
  Arr.forEach(states, (state, index) => {
    const spot = plotPoint(state, axes, plot);
    positions.set([spot.x, spot.y, 0, spot.x, 0, 0], index * 6);
  });
  return positions;
}

/** The triangles of a band of `count` + 1 states: two between each state and the next. */
export function bandIndex(count: number) {
  return Arr.flatMap(Arr.range(0, count - 1), (index) => {
    const top = index * 2;
    return [top, top + 1, top + 2, top + 1, top + 3, top + 2];
  });
}

/**
 * The isotherm through a state, where p V keeps its value, as `count` + 1
 * places on the plot from where it comes in at the top to the right edge;
 * none when it passes above the plot.
 */
export function isothermSpots(
  state: GasState,
  axes: Axes,
  plot: Plot,
  count: number
) {
  const product = state.pressure * state.volume;
  const from = product / axes.pressure.maximum;
  const to = axes.volume.maximum;
  if (from >= to) {
    return [];
  }
  return Arr.makeBy(count + 1, (index) => {
    const volume = from * (to / from) ** (index / count);
    return plotPoint({ pressure: product / volume, volume }, axes, plot);
  });
}

/**
 * Where the arrowhead on a path stands, halfway along it, and the angle it
 * points in, in radians from the volume axis; none on a path too short to
 * point anywhere.
 */
export function arrowOn(spots: readonly Spot[]) {
  const middle = Math.floor(spots.length / 2);
  return Option.flatMap(
    Option.all([Arr.get(spots, middle - 1), Arr.get(spots, middle + 1)]),
    ([before, after]) => {
      const across = after.x - before.x;
      const up = after.y - before.y;
      return Math.hypot(across, up) < 1e-6
        ? Option.none()
        : Option.some({
            angle: Math.atan2(up, across),
            x: (before.x + after.x) / 2,
            y: (before.y + after.y) / 2,
          });
    }
  );
}

/**
 * The heights two labels stand at, moved apart evenly about their middle
 * when they would stand closer than `gap`, so neither covers the other, and
 * lifted together so the lower stands no lower than `floor`.
 */
export function spreadApart(
  heights: readonly [number, number],
  gap: number,
  floor: number
): readonly [number, number] {
  const [first, second] = heights;
  const middle = (first + second) / 2;
  const half = Math.max(Math.abs(second - first), gap) / 2;
  const low = Math.max(middle - half, floor);
  const high = low + 2 * half;
  return first <= second ? [low, high] : [high, low];
}

/**
 * Which side of its point each end's name stands: 1 up and right, -1 down
 * and left. Isotherms run up-left and down-right through every point, so
 * those two corners are clear of them; the end's name stands on the side
 * the path runs toward, and the start's on the other.
 */
export function tagSides(from: Spot, to: Spot) {
  const end = to.x - from.x + (to.y - from.y) >= 0 ? 1 : -1;
  return { end, start: -end };
}
