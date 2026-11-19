import { Array as Arr, Order, String as Str } from "effect";

/**
 * The chart's tick text in pixels (`text-xs` on the chart container) and the
 * width of an average glyph of its sans font as a share of it, taken on the
 * wide side so a label is never judged narrower than it draws.
 */
const TICK_FONT = 12;
const GLYPH = 0.6;

/** The spaces between the words of a label. */
const SPACES = /\s+/u;

/** The room kept clear between two neighbouring labels, in pixels. */
export const TICK_GUTTER = 6;

/**
 * How a category axis writes its labels in bands of `band` pixels: each label
 * wrapped onto lines as wide as its band while its longest word fits there,
 * else every label at a slant, so no label is ever dropped or runs into its
 * neighbour. One answer holds for the whole axis, so its labels read alike.
 */
export function categoryLayout({
  band,
  labels,
}: {
  readonly band: number;
  readonly labels: readonly string[];
}) {
  const longest = Arr.reduce(
    Arr.flatMap(labels, (label) => Str.split(Str.trim(label), SPACES)),
    0,
    (most, word) => Order.max(Order.Number)(most, word.length)
  );
  return longest * TICK_FONT * GLYPH + TICK_GUTTER <= band
    ? ("wrap" as const)
    : ("slant" as const);
}
