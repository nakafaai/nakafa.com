import { Match, Schema } from "effect";

const SecantCurveSchema = Schema.Literals(["quadratic", "cubic", "sineWave"]);

export type SecantCurve = typeof SecantCurveSchema.Type;

const SecantMetricsSchema = Schema.Struct({
  anchorY: Schema.Finite,
  movingY: Schema.Finite,
  secantSlope: Schema.Finite,
  tangentSlope: Schema.Finite,
});

/** Evaluate f(x) and exact derivative f'(x) for each secant-to-tangent curve. */
export function sampleSecantCurve(curve: SecantCurve, x: number): number {
  return Match.value(curve).pipe(
    Match.when("quadratic", () => 0.45 * x * x + 0.2),
    Match.when("cubic", () => 0.16 * x * x * x + 0.25 * x + 0.5),
    Match.when("sineWave", () => 0.75 * Math.sin(x) + 0.9),
    Match.exhaustive
  );
}

/** Evaluate secant slope between a=0.5 and a+h versus exact tangent slope f'(a). */
export function evaluateSecantLimit(
  curve: SecantCurve,
  stepH: number
): typeof SecantMetricsSchema.Type {
  const a = 0.5;
  const h = Math.max(0.02, stepH);
  const anchorY = sampleSecantCurve(curve, a);
  const movingY = sampleSecantCurve(curve, a + h);
  const tangentSlope = Match.value(curve).pipe(
    Match.when("quadratic", () => 0.9 * a),
    Match.when("cubic", () => 0.48 * a * a + 0.25),
    Match.when("sineWave", () => 0.75 * Math.cos(a)),
    Match.exhaustive
  );

  return {
    anchorY,
    movingY,
    secantSlope: Number(((movingY - anchorY) / h).toFixed(3)),
    tangentSlope: Number(tangentSlope.toFixed(3)),
  };
}
