import { Array as Arr } from "effect";

/**
 * Spreads labels along a line so that no two stand closer than `gap`: each
 * label, from the first, steps right of the one before it when it would
 * crowd it, and the whole row then moves back so its middle stays where the
 * labels' marks are. Labels already far enough apart keep their places.
 *
 * @param marks - The places the labels belong to, in rising order
 */
export function spreadLabels(marks: readonly number[], gap: number) {
  const [first, ...rest] = marks;
  if (first === undefined) {
    return [];
  }
  const pushed = Arr.scan(rest, first, (before, mark) =>
    Math.max(mark, before + gap)
  );
  const total = (places: readonly number[]) =>
    Arr.reduce(places, 0, (sum, place) => sum + place);
  const shift = (total(marks) - total(pushed)) / marks.length;
  return Arr.map(pushed, (place) => place + shift);
}
