import { Array as Arr, Schema } from "effect";

export const LimitingFactorSchema = Schema.Literals(["substrate", "enzyme"]);
export type LimitingFactor = typeof LimitingFactorSchema.Type;

const SaturationStateSchema = Schema.Struct({
  busySites: Schema.Finite,
  limiting: LimitingFactorSchema,
  occupancy: Schema.Finite,
  rate: Schema.Finite,
});
export type SaturationState = typeof SaturationStateSchema.Type;

const CurvePointSchema = Schema.Struct({
  rate: Schema.Finite,
  substrates: Schema.Finite,
});
export type CurvePoint = typeof CurvePointSchema.Type;

/**
 * Evaluates Michaelis-Menten active-site occupancy and reaction rate for a
 * given enzyme count, substrate count, and single-site catalytic turnover.
 */
export function evaluateSaturation(
  enzymes: number,
  substrates: number,
  turnover: number
): SaturationState {
  const halfMax = Math.max(8, enzymes * 2.2);
  const occupancy = substrates <= 0 ? 0 : substrates / (substrates + halfMax);
  const busySites = Math.round(enzymes * occupancy * 10) / 10;
  const rate = Math.round(busySites * turnover * 10) / 10;
  const limiting: LimitingFactor = occupancy >= 0.78 ? "enzyme" : "substrate";
  return { busySites, limiting, occupancy, rate };
}

/** Samples the rate-versus-substrate saturation curve for plotting. */
export function saturationCurve(
  enzymes: number,
  maxSubstrates: number,
  turnover: number,
  steps = 40
): readonly CurvePoint[] {
  return Arr.makeBy(steps + 1, (index) => {
    const substrates = (maxSubstrates * index) / steps;
    return {
      rate: evaluateSaturation(enzymes, substrates, turnover).rate,
      substrates,
    };
  });
}

/** Total product molecules formed after `seconds`, capped by initial substrate. */
export function productsAt(
  rate: number,
  seconds: number,
  substrates: number
): number {
  return Math.min(substrates, Math.round(rate * seconds));
}
