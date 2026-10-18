import { Array as Arr, Option, Order, Schema } from "effect";

/** One category of a series, and the value that the series takes in it. */
const CategoryValueSchema = Schema.Struct({
  category: Schema.String,
  value: Schema.Finite,
});

/** The readings of one series: its highest and lowest category, its mean, and its range. */
const SeriesSummarySchema = Schema.Struct({
  highest: CategoryValueSchema,
  lowest: CategoryValueSchema,
  mean: Schema.Finite,
  range: Schema.Finite,
});

/** The readings of one series. */
type SeriesSummary = typeof SeriesSummarySchema.Type;

/** The sum of some values, which is zero when there are none. */
export function totalOf(values: readonly number[]) {
  return Arr.reduce(values, 0, (total, value) => total + value);
}

/**
 * Reads one series of a chart: the category of its highest and of its lowest
 * value, the range between those two values, and its mean. A series without
 * categories has no reading.
 */
export function summarizeSeries(
  categories: readonly string[],
  values: readonly number[]
): Option.Option<SeriesSummary> {
  const pairs = Arr.zip(categories, values);
  if (!Arr.isReadonlyArrayNonEmpty(pairs)) {
    return Option.none();
  }

  const points = Arr.map(pairs, ([category, value]) => ({ category, value }));
  const byValue = Order.mapInput(
    Order.Number,
    (point: typeof CategoryValueSchema.Type) => point.value
  );
  const highest = Arr.max(points, byValue);
  const lowest = Arr.min(points, byValue);
  const total = totalOf(Arr.map(points, (point) => point.value));
  return Option.some({
    highest,
    lowest,
    mean: total / points.length,
    range: highest.value - lowest.value,
  });
}
