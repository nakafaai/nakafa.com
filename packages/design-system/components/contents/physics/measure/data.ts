import { Array as Arr, Schema } from "effect";

/**
 * Measurement and graphs for the measurement labs. Readings are precise
 * when they lie close together, a small range, and accurate when their mean
 * lies close to the actual value; a steady offset in every reading is a
 * systematic error such as a zero error. A pendulum's period follows
 * T² = (4π² / g) L for its effective length L, so lengths measured short by
 * the bob's radius shift the line without changing its gradient. The area
 * under a velocity-time graph is the displacement, counted negative below
 * the time axis, while the distance counts every area as positive.
 */

/** The mean, the range and the offset from the actual value of a set of readings. */
export function readingStats(
  readings: Arr.NonEmptyReadonlyArray<number>,
  actual: number
) {
  const mean =
    Arr.reduce(readings, 0, (sum, reading) => sum + reading) / readings.length;
  const highest = Math.max(...readings);
  const lowest = Math.min(...readings);
  return { mean, offset: mean - actual, range: highest - lowest };
}

/** The gravitational acceleration from the gradient of a T² against L graph, and where the line cuts each axis when lengths are measured `short` too little. */
export function pendulumLine(gradient: number, short: number) {
  return {
    gravity: (4 * Math.PI ** 2) / gradient,
    lengthIntercept: -short,
    periodIntercept: gradient * short,
  };
}

/** One stretch of a velocity-time graph: it lasts `duration` seconds and ends at `end` m s⁻¹, changing steadily from where the last one ended. */
const StretchSchema = Schema.Struct({
  duration: Schema.Finite,
  end: Schema.Finite,
});
type Stretch = typeof StretchSchema.Type;

/** The signed area of each stretch, the displacement and the distance, for a motion that starts at `start` m s⁻¹. */
export function motionAreas(start: number, stretches: readonly Stretch[]) {
  const areas = Arr.map(
    Arr.zip(
      Arr.prepend(
        Arr.map(stretches, (stretch) => stretch.end),
        start
      ),
      stretches
    ),
    ([from, stretch]) => signedArea(from, stretch.end, stretch.duration)
  );
  return {
    areas,
    displacement: Arr.reduce(areas, 0, (sum, area) => sum + area),
    distance: Arr.reduce(areas, 0, (sum, area) => sum + Math.abs(area)),
  };
}

/**
 * The signed area under a straight velocity line from `from` to `to` over
 * `duration`. A line that crosses zero splits into a part above and a part
 * below the axis, which partly cancel.
 */
function signedArea(from: number, to: number, duration: number) {
  if (from * to >= 0) {
    return ((from + to) / 2) * duration;
  }
  const crossing =
    (duration * Math.abs(from)) / (Math.abs(from) + Math.abs(to));
  return (from / 2) * crossing + (to / 2) * (duration - crossing);
}
