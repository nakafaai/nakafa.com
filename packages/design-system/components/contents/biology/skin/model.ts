import { Match, Schema } from "effect";

const ThermalConditionSchema = Schema.Literals(["cold", "normal", "hot"]);

export type ThermalCondition = typeof ThermalConditionSchema.Type;

const SkinReadingSchema = Schema.Struct({
  arterioleScale: Schema.Finite,
  bloodFlowPercent: Schema.Int,
  hairAngleRad: Schema.Finite,
  heatLossPercent: Schema.Int,
  sweatActive: Schema.Boolean,
  sweatIntensity: Schema.Finite,
});

/**
 * Evaluate arteriolar vasodilation/vasoconstriction, hair shaft angle, sweat
 * output, and heat loss continuously across both preset condition and ambient
 * temperature slider so the 3D dermal cross-section responds immediately.
 */
export function evaluateSkin(
  condition: ThermalCondition,
  ambientC: number
): typeof SkinReadingSchema.Type {
  const tempBias = Math.min(1, Math.max(-1, (ambientC - 24) / 16));
  return Match.value(condition).pipe(
    Match.when("cold", () => {
      const arterioleScale = Math.max(
        0.38,
        Math.min(0.85, 0.55 + tempBias * 0.18)
      );
      const hairAngleRad = Math.max(
        0.03,
        Math.min(0.32, 0.12 + tempBias * 0.1)
      );
      return {
        arterioleScale,
        bloodFlowPercent: Math.max(15, Math.round(28 + tempBias * 10)),
        hairAngleRad,
        heatLossPercent: Math.max(12, Math.round(22 + tempBias * 8)),
        sweatActive: false,
        sweatIntensity: 0,
      };
    }),
    Match.when("normal", () => {
      const arterioleScale = Math.max(
        0.68,
        Math.min(1.38, 1 + tempBias * 0.28)
      );
      const hairAngleRad = Math.max(
        0.16,
        Math.min(0.88, 0.45 + tempBias * 0.28)
      );
      const sweatIntensity = Math.max(0, Math.min(0.7, (ambientC - 29) / 13));
      return {
        arterioleScale,
        bloodFlowPercent: Math.round(55 + tempBias * 10),
        hairAngleRad,
        heatLossPercent: Math.round(50 + tempBias * 10),
        sweatActive: sweatIntensity > 0.05,
        sweatIntensity,
      };
    }),
    Match.when("hot", () => {
      const arterioleScale = Math.max(
        1.18,
        Math.min(1.85, 1.52 + tempBias * 0.25)
      );
      const hairAngleRad = Math.max(
        0.72,
        Math.min(1.24, 1.02 + tempBias * 0.18)
      );
      const sweatIntensity = Math.max(
        0.35,
        Math.min(1, 0.65 + tempBias * 0.35)
      );
      return {
        arterioleScale,
        bloodFlowPercent: Math.min(100, Math.round(88 + tempBias * 10)),
        hairAngleRad,
        heatLossPercent: Math.min(100, Math.round(86 + tempBias * 10)),
        sweatActive: true,
        sweatIntensity,
      };
    }),
    Match.exhaustive
  );
}
