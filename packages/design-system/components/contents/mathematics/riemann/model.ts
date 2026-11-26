import { Match, Schema } from "effect";

const RiemannMethodSchema = Schema.Literals([
  "left",
  "right",
  "midpoint",
  "trapezoid",
]);

export type RiemannMethod = typeof RiemannMethodSchema.Type;

const RiemannCurveSchema = Schema.Literals([
  "parabola",
  "sineArch",
  "exponential",
]);

export type RiemannCurve = typeof RiemannCurveSchema.Type;

const RiemannSummarySchema = Schema.Struct({
  approxArea: Schema.Finite,
  exactIntegral: Schema.Finite,
});

/** Sample integrand f(x) over [0, 2]. */
export function sampleRiemannCurve(curve: RiemannCurve, x: number): number {
  return Match.value(curve).pipe(
    Match.when("parabola", () => 0.4 * x * x + 0.35),
    Match.when("sineArch", () => 1.35 * Math.sin((x * Math.PI) / 2) + 0.15),
    Match.when("exponential", () => 0.35 * Math.exp(0.75 * x)),
    Match.exhaustive
  );
}

/** Evaluate Riemann sum approximation versus exact definite integral over [0, 2]. */
export function evaluateRiemannSum(
  curve: RiemannCurve,
  method: RiemannMethod,
  partitions: number
): typeof RiemannSummarySchema.Type {
  const n = Math.max(1, Math.round(partitions));
  const dx = 2 / n;
  let sum = 0;

  for (let i = 0; i < n; i += 1) {
    const x0 = i * dx;
    const x1 = (i + 1) * dx;
    const height = Match.value(method).pipe(
      Match.when("left", () => sampleRiemannCurve(curve, x0)),
      Match.when("right", () => sampleRiemannCurve(curve, x1)),
      Match.when("midpoint", () => sampleRiemannCurve(curve, (x0 + x1) * 0.5)),
      Match.when(
        "trapezoid",
        () =>
          (sampleRiemannCurve(curve, x0) + sampleRiemannCurve(curve, x1)) * 0.5
      ),
      Match.exhaustive
    );
    sum += height * dx;
  }

  const exactIntegral = Match.value(curve).pipe(
    Match.when("parabola", () => (0.4 * 8) / 3 + 0.7),
    Match.when("sineArch", () => (1.35 * 4) / Math.PI + 0.3),
    Match.when("exponential", () => (0.35 / 0.75) * (Math.exp(1.5) - 1)),
    Match.exhaustive
  );

  return {
    approxArea: Number(sum.toFixed(3)),
    exactIntegral: Number(exactIntegral.toFixed(3)),
  };
}
