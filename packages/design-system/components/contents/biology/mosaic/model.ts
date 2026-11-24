import { Schema } from "effect";

const MembraneComponentSchema = Schema.Literals([
  "phospholipid",
  "cholesterol",
  "integralProtein",
  "glycoprotein",
]);

export type MembraneComponent = typeof MembraneComponentSchema.Type;

const FluidityReadingSchema = Schema.Struct({
  fluidityPercent: Schema.Int,
  lateralWaveAmplitude: Schema.Finite,
  lateralWaveSpeed: Schema.Finite,
});

/**
 * Evaluate phospholipid bilayer fluidity and lateral drift amplitude
 * as a function of temperature (in degrees Celsius).
 */
export function evaluateMembraneFluidity(
  temperatureC: number
): typeof FluidityReadingSchema.Type {
  const t = Math.min(60, Math.max(0, temperatureC));
  const ratio = t / 60;
  return {
    fluidityPercent: Math.round(18 + ratio * 78),
    lateralWaveAmplitude: Number((0.012 + ratio * 0.055).toFixed(3)),
    lateralWaveSpeed: Number((0.55 + ratio * 2.2).toFixed(2)),
  };
}
