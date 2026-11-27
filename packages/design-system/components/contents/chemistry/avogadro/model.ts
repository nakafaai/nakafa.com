import { Schema } from "effect";

const GasConditionSchema = Schema.Literals(["stp", "rtp"]);

export type GasCondition = typeof GasConditionSchema.Type;

const GasVolumeReadingSchema = Schema.Struct({
  molarVolumeDm3: Schema.Finite,
  moleculesMath: Schema.String,
  volumeDm3: Schema.Finite,
});

/** Compute molar gas volume and Avogadro particle count at STP or RTP. */
export function evaluateAvogadroGas(
  condition: GasCondition,
  moles: number
): typeof GasVolumeReadingSchema.Type {
  const n = Math.max(0.1, moles);
  const molarVolumeDm3 = condition === "stp" ? 22.4 : 24;
  const volumeDm3 = Number((n * molarVolumeDm3).toFixed(1));
  const scaled = (n * 6.02).toFixed(2);
  return {
    molarVolumeDm3,
    moleculesMath: `${scaled} \\times 10^{23}`,
    volumeDm3,
  };
}
