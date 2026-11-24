import { Schema } from "effect";

const AuxinBendSchema = Schema.Struct({
  bendDegrees: Schema.Int,
  elongationPercent: Schema.Int,
});

/**
 * Evaluate coleoptile curvature angle and asymmetric cell elongation
 * from an off-centre auxin-infused agar block (0-100 scale).
 */
export function evaluateAuxinBend(
  auxinLevel: number
): typeof AuxinBendSchema.Type {
  const level = Math.min(100, Math.max(0, auxinLevel));
  return {
    bendDegrees: Math.round((level / 100) * 52),
    elongationPercent: Math.round(100 + (level / 100) * 65),
  };
}
