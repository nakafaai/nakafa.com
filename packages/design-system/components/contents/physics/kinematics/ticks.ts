import { Array as Arr } from "effect";

/** The round steps a tick may take within one power of ten. */
const STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * The ticks of a graph's axis that covers `low` to `high`: about five of
 * them, a round step apart, from the last round number at or below `low`
 * to the first at or beyond `high`, so every gridline of a motion graph is
 * a number a reader can name.
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
  const first = Math.floor(low / step + 1e-9) * step;
  const count = Math.ceil((high - first) / step - 1e-9);
  return Arr.makeBy(count + 1, (index) => first + index * step);
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

/**
 * Which labels of a row keep their place so that no two of them touch: a
 * label is the same size on screen however far away its post stands, so a
 * row of posts that runs into the distance can carry only some of them.
 * Going along the row, a label stays when it stands at least `room` pixels
 * from the last one that stayed. A place that is not a number is off the
 * screen and carries no label.
 *
 * @param places - Where each label stands across the screen, in pixels
 * @param room - The least distance between two labels, in pixels
 * @returns One bit for each label, set when the label stays
 */
export function roomyLabels(places: ArrayLike<number>, room: number) {
  let kept = 0;
  let last = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < places.length; index += 1) {
    const place = Number(places[index]);
    if (Math.abs(place - last) >= room) {
      kept += 2 ** index;
      last = place;
    }
  }
  return kept;
}
