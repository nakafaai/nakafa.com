import { Match, Schema } from "effect";

const CrossOrderSchema = Schema.Literals(["uCrossV", "vCrossU"]);

export type CrossOrder = typeof CrossOrderSchema.Type;

const CrossMetricsSchema = Schema.Struct({
  area: Schema.Finite,
  sign: Schema.Finite,
  signedNormalY: Schema.Finite,
});

/** Compute parallelogram area |u x v| and signed right-hand normal for |u|=2, |v|=1.5. */
export function evaluateCrossProduct(
  order: CrossOrder,
  angleDeg: number
): typeof CrossMetricsSchema.Type {
  const rad = (angleDeg * Math.PI) / 180;
  const area = Math.abs(2 * 1.5 * Math.sin(rad));
  const sign = Match.value(order).pipe(
    Match.when("uCrossV", () => 1),
    Match.when("vCrossU", () => -1),
    Match.exhaustive
  );

  return {
    area: Number(area.toFixed(2)),
    sign,
    signedNormalY: Number((sign * area).toFixed(2)),
  };
}
