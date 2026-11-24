import { Schema } from "effect";

const WaterDirectionSchema = Schema.Literals([
  "intoRoot",
  "balanced",
  "outOfRoot",
]);

export type WaterDirection = typeof WaterDirectionSchema.Type;

const RootUptakeSchema = Schema.Struct({
  atpActive: Schema.Boolean,
  direction: WaterDirectionSchema,
  fluxSpeed: Schema.Finite,
});

/**
 * Evaluate osmotic water flow direction and ATP mineral ion uptake
 * across a root hair epidermis given soil solute concentration (0-100).
 */
export function evaluateRootUptake(
  soilConcentration: number
): typeof RootUptakeSchema.Type {
  const clamped = Math.min(100, Math.max(0, soilConcentration));
  if (clamped < 45) {
    return {
      atpActive: true,
      direction: "intoRoot",
      fluxSpeed: Number(((45 - clamped) / 45 + 0.35).toFixed(2)),
    };
  }
  if (clamped <= 55) {
    return {
      atpActive: true,
      direction: "balanced",
      fluxSpeed: 0.15,
    };
  }
  return {
    atpActive: true,
    direction: "outOfRoot",
    fluxSpeed: Number(((clamped - 55) / 45 + 0.35).toFixed(2)),
  };
}
