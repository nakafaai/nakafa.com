import { Match, Schema } from "effect";

const ThermalConditionSchema = Schema.Literals(["cold", "normal", "hot"]);

export type ThermalCondition = typeof ThermalConditionSchema.Type;

const SkinReadingSchema = Schema.Struct({
  arterioleScale: Schema.Finite,
  bloodFlowPercent: Schema.Int,
  hairAngleRad: Schema.Finite,
  heatLossPercent: Schema.Int,
  sweatActive: Schema.Boolean,
});

/** Evaluate arteriolar vasodilation/vasoconstriction, hair angle, sweat output, and heat loss. */
export function evaluateSkin(
  condition: ThermalCondition,
  ambientC: number
): typeof SkinReadingSchema.Type {
  const tempBias = Math.min(1, Math.max(-1, (ambientC - 24) / 16));
  return Match.value(condition).pipe(
    Match.when("cold", () => ({
      arterioleScale: 0.55,
      bloodFlowPercent: Math.max(15, Math.round(28 + tempBias * 10)),
      hairAngleRad: 0.08,
      heatLossPercent: Math.max(12, Math.round(22 + tempBias * 8)),
      sweatActive: false,
    })),
    Match.when("normal", () => ({
      arterioleScale: 1,
      bloodFlowPercent: Math.round(55 + tempBias * 10),
      hairAngleRad: 0.45,
      heatLossPercent: Math.round(50 + tempBias * 10),
      sweatActive: false,
    })),
    Match.when("hot", () => ({
      arterioleScale: 1.55,
      bloodFlowPercent: Math.min(100, Math.round(88 + tempBias * 10)),
      hairAngleRad: 1.05,
      heatLossPercent: Math.min(100, Math.round(86 + tempBias * 10)),
      sweatActive: true,
    })),
    Match.exhaustive
  );
}
