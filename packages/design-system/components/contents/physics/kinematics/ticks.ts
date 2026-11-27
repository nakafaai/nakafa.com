import { Array as Arr } from "effect";

/** The round steps a tick may take within one power of ten. */
const STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * The ticks of a graph's axis that covers `low` to `high`: about five of
 * them, a round step apart, from `low` to the first tick at or beyond
 * `high`, so every gridline of a motion graph is a number a reader can name.
 *
 * @param low - The least value the axis shows
 * @param high - The greatest value the axis must reach
 */
export function axisTicks(low: number, high: number) {
  const rough = Math.max(high - low, Number.EPSILON) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    Math.min(
      ...Arr.filter(STEPS, (candidate) => candidate * magnitude >= rough)
    ) * magnitude;
  const count = Math.ceil((high - low) / step - 1e-9);
  return Arr.makeBy(count + 1, (index) => low + index * step);
}

/**
 * Points of a curve sampled evenly over a span of time, for a graph to
 * join: `count` steps from `start` to `end`, each with the value `at` gives.
 *
 * @param start - The first moment, in seconds
 * @param end - The last moment, in seconds
 * @param count - How many steps the span is cut into
 * @param at - The plotted quantity at a moment
 */
export function curvePoints(
  start: number,
  end: number,
  count: number,
  at: (time: number) => number
) {
  return Arr.makeBy(count + 1, (index) => {
    const x = start + ((end - start) * index) / count;
    return { x, y: at(x) };
  });
}
