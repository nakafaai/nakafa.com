import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { Array as Arr, Order, Schema } from "effect";

/** A closed range of numbers: its smallest value and its largest. */
export const IntervalSchema = Schema.Struct({
  max: Schema.Finite,
  min: Schema.Finite,
});

/** A closed range of numbers. */
export type Interval = typeof IntervalSchema.Type;

/** The smallest and the largest of some numbers. */
export function intervalOf(
  values: Arr.NonEmptyReadonlyArray<number>
): Interval {
  return {
    max: Arr.max(values, Order.Number),
    min: Arr.min(values, Order.Number),
  };
}

/**
 * The separator between the bounds of an interval: a semicolon in German and
 * Indonesian, where the decimal mark is a comma, and a comma elsewhere.
 */
export function intervalSeparator(locale: string) {
  return locale === "de" || locale === "id" ? "; " : ", ";
}

/**
 * An interval as math, in square brackets. `formatNumber` writes each bound in
 * the locale's number format, and a decimal comma inside it stays whole.
 */
export function formatInterval(
  interval: Interval,
  formatNumber: (value: number) => string,
  separator: string
) {
  const min = mathNumber(formatNumber(interval.min));
  const max = mathNumber(formatNumber(interval.max));
  return `[${min}${separator}${max}]`;
}
