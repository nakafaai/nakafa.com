import { Array as Arr, Number as Num, Option, Order, Schema } from "effect";

/** One observation of a scatter diagram. */
const RegressionPointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** The least-squares line `y = m * x + b`, and the x range of the points it fits. */
const RegressionLineSchema = Schema.Struct({
  b: Schema.Finite,
  m: Schema.Finite,
  xMax: Schema.Finite,
  xMin: Schema.Finite,
});

/** The y of a regression line at `x`. */
export function predictY(
  { b, m }: typeof RegressionLineSchema.Type,
  x: number
) {
  return m * x + b;
}

/**
 * Fits the least-squares line through a set of scatter points. Fewer than two
 * points, or points that all share one x, leave the line undefined.
 */
export function fitRegressionLine(
  points: readonly (typeof RegressionPointSchema.Type)[]
): Option.Option<typeof RegressionLineSchema.Type> {
  if (!Arr.isReadonlyArrayNonEmpty(points) || points.length < 2) {
    return Option.none();
  }

  const count = points.length;
  const xs = Arr.map(points, (point) => point.x);
  const sumX = Num.sumAll(xs);
  const sumY = Num.sumAll(Arr.map(points, (point) => point.y));
  const sumXy = Num.sumAll(Arr.map(points, (point) => point.x * point.y));
  const sumX2 = Num.sumAll(Arr.map(points, (point) => point.x * point.x));
  const denominator = count * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return Option.none();
  }

  const m = (count * sumXy - sumX * sumY) / denominator;

  return Option.some({
    b: (sumY - m * sumX) / count,
    m,
    xMax: Arr.max(xs, Order.Number),
    xMin: Arr.min(xs, Order.Number),
  });
}
