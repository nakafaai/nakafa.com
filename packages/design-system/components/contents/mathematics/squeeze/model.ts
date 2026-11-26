import { Match, Schema } from "effect";

const SqueezeEnvelopeSchema = Schema.Literals([
  "quadraticSine",
  "linearDamped",
  "sincEnvelope",
]);

export type SqueezeEnvelope = typeof SqueezeEnvelopeSchema.Type;

const SqueezeMetricsSchema = Schema.Struct({
  boundSpread: Schema.Finite,
  limitValue: Schema.Finite,
  upperAtRadius: Schema.Finite,
});

/** Compute upper envelope height and total vertical spread at window radius r. */
export function evaluateSqueezeTheorem(
  envelope: SqueezeEnvelope,
  radius: number
): typeof SqueezeMetricsSchema.Type {
  const r = Math.max(0.02, radius);
  return Match.value(envelope).pipe(
    Match.when("quadraticSine", () => ({
      boundSpread: Number((2 * r * r).toFixed(3)),
      limitValue: 0,
      upperAtRadius: Number((r * r).toFixed(3)),
    })),
    Match.when("linearDamped", () => ({
      boundSpread: Number((2 * r).toFixed(3)),
      limitValue: 0,
      upperAtRadius: Number(r.toFixed(3)),
    })),
    Match.when("sincEnvelope", () => {
      const upper = 1;
      const lower = Math.cos(r);
      return {
        boundSpread: Number(Math.max(0, upper - lower).toFixed(3)),
        limitValue: 1,
        upperAtRadius: upper,
      };
    }),
    Match.exhaustive
  );
}
