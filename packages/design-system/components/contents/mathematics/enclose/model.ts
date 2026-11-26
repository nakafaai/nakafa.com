import { Match, Schema } from "effect";

const CurvePairSchema = Schema.Literals([
  "lineAndParabola",
  "twoParabolas",
  "sineAndCosine",
]);

export type CurvePair = typeof CurvePairSchema.Type;

const EnclosedMetricsSchema = Schema.Struct({
  enclosedArea: Schema.Finite,
  gapAtBound: Schema.Finite,
  lowerY: Schema.Finite,
  upperY: Schema.Finite,
});

const CurvePairSampleSchema = Schema.Struct({
  lower: Schema.Finite,
  upper: Schema.Finite,
});

/** Sample upper and lower curves at x in [0, 2]. */
export function sampleCurvePair(
  pair: CurvePair,
  x: number
): typeof CurvePairSampleSchema.Type {
  return Match.value(pair).pipe(
    Match.when("lineAndParabola", () => ({
      lower: 0.35 * x * x + 0.15,
      upper: 0.7 * x + 0.15,
    })),
    Match.when("twoParabolas", () => ({
      lower: 0.3 * (x - 1) * (x - 1) + 0.2,
      upper: 1.4 - 0.3 * (x - 1) * (x - 1),
    })),
    Match.when("sineAndCosine", () => ({
      lower: 0.35 + 0.25 * Math.cos(x * 1.3),
      upper: 0.85 + 0.45 * Math.sin(x * 1.1),
    })),
    Match.exhaustive
  );
}

/** Numerically integrate enclosed area between upper f(x) and lower g(x) from 0 to upperBound. */
export function evaluateAreaBetweenCurves(
  pair: CurvePair,
  upperBound: number
): typeof EnclosedMetricsSchema.Type {
  const b = Math.min(2, Math.max(0.1, upperBound));
  const steps = 40;
  const dx = b / steps;
  let area = 0;
  for (let i = 0; i < steps; i += 1) {
    const mid = (i + 0.5) * dx;
    const { lower, upper } = sampleCurvePair(pair, mid);
    area += Math.max(0, upper - lower) * dx;
  }
  const edge = sampleCurvePair(pair, b);
  return {
    enclosedArea: Number(area.toFixed(3)),
    gapAtBound: Number(Math.max(0, edge.upper - edge.lower).toFixed(3)),
    lowerY: Number(edge.lower.toFixed(3)),
    upperY: Number(edge.upper.toFixed(3)),
  };
}
