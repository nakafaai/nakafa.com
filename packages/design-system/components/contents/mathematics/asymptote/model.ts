import { Match, Schema } from "effect";

const AsymptoteCurveSchema = Schema.Literals([
  "reciprocalPole",
  "rationalHorizontal",
  "obliqueSlant",
]);

export type AsymptoteCurve = typeof AsymptoteCurveSchema.Type;

const AsymptoteProbeSchema = Schema.Struct({
  horizontalY: Schema.Finite,
  valueY: Schema.Finite,
  verticalX: Schema.Finite,
});

/** Evaluate rational asymptote curve height and asymptote locations at probe x. */
export function evaluateAsymptoteProbe(
  curve: AsymptoteCurve,
  probeX: number
): typeof AsymptoteProbeSchema.Type {
  const safeDenom = (d: number) => {
    if (Math.abs(d) < 0.12) {
      return d >= 0 ? 0.12 : -0.12;
    }
    return d;
  };

  return Match.value(curve).pipe(
    Match.when("reciprocalPole", () => ({
      horizontalY: 0,
      valueY: Number((0.45 / safeDenom(probeX)).toFixed(2)),
      verticalX: 0,
    })),
    Match.when("rationalHorizontal", () => ({
      horizontalY: 0.8,
      valueY: Number(
        ((0.8 * probeX + 0.35) / safeDenom(probeX - 0.3)).toFixed(2)
      ),
      verticalX: 0.3,
    })),
    Match.when("obliqueSlant", () => ({
      horizontalY: Number((0.45 * probeX).toFixed(2)),
      valueY: Number((0.45 * probeX + 0.3 / safeDenom(probeX)).toFixed(2)),
      verticalX: 0,
    })),
    Match.exhaustive
  );
}
