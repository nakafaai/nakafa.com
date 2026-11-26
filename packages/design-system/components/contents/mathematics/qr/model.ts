import { Match, Schema } from "effect";

const QrStepSchema = Schema.Literals([
  "originalBasis",
  "normalizeQ1",
  "orthogonalizeQ2",
  "orthogonalizeQ3",
]);

export type QrStep = typeof QrStepSchema.Type;

const QrStateSchema = Schema.Struct({
  orthogonalityError: Schema.Finite,
  q2TiltRad: Schema.Finite,
  q3TiltRad: Schema.Finite,
  r12: Schema.Finite,
});

/** Compute Gram-Schmidt step tilt angles, R12 projection coordinate, and orthogonality residual. */
export function evaluateQrStep(
  step: QrStep,
  skew: number
): typeof QrStateSchema.Type {
  const s = Math.min(1, Math.max(0, skew));
  const r12 = Number((0.85 * s).toFixed(2));
  return Match.value(step).pipe(
    Match.when("originalBasis", () => ({
      orthogonalityError: Number((0.75 * s).toFixed(2)),
      q2TiltRad: 0.65 * s,
      q3TiltRad: 0.55 * s,
      r12,
    })),
    Match.when("normalizeQ1", () => ({
      orthogonalityError: Number((0.6 * s).toFixed(2)),
      q2TiltRad: 0.65 * s,
      q3TiltRad: 0.55 * s,
      r12,
    })),
    Match.when("orthogonalizeQ2", () => ({
      orthogonalityError: Number((0.28 * s).toFixed(2)),
      q2TiltRad: 0,
      q3TiltRad: 0.55 * s,
      r12,
    })),
    Match.when("orthogonalizeQ3", () => ({
      orthogonalityError: 0,
      q2TiltRad: 0,
      q3TiltRad: 0,
      r12,
    })),
    Match.exhaustive
  );
}
