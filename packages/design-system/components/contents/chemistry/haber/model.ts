import { Schema } from "effect";

const HaberReadingSchema = Schema.Struct({
  relativeRate: Schema.Int,
  yieldPercent: Schema.Int,
});

/**
 * Evaluate Haber-Bosch equilibrium NH3 yield (favoured by low T, high P)
 * versus kinetic rate (favoured by high T, high P).
 */
export function evaluateHaberConverter(
  temperatureC: number,
  pressureAtm: number
): typeof HaberReadingSchema.Type {
  const t = Math.min(600, Math.max(250, temperatureC));
  const p = Math.min(400, Math.max(20, pressureAtm));
  const tempPenalty = (t - 250) / 350;
  const pressGain = p / 300;
  const yieldPercent = Math.round(
    Math.min(72, Math.max(4, (1 - tempPenalty * 0.78) * 56 * pressGain))
  );
  const relativeRate = Math.round(
    Math.min(
      100,
      Math.max(10, (0.2 + tempPenalty * 0.8) * (0.5 + pressGain * 0.5) * 100)
    )
  );
  return {
    relativeRate,
    yieldPercent,
  };
}
