import { Match, Schema } from "effect";

const SpecialNutritionModeSchema = Schema.Literals([
  "carnivorous",
  "parasitic",
  "epiphytic",
]);

export type SpecialNutritionMode = typeof SpecialNutritionModeSchema.Type;

const NutritionProfileSchema = Schema.Struct({
  hasChlorophyll: Schema.Boolean,
  tapsHostVascular: Schema.Boolean,
  trapsInsects: Schema.Boolean,
});

/** Characterise chlorophyll presence, host tapping, and insect trapping by mode. */
export function evaluateSpecialNutrition(
  mode: SpecialNutritionMode
): typeof NutritionProfileSchema.Type {
  return Match.value(mode).pipe(
    Match.when("carnivorous", () => ({
      hasChlorophyll: true,
      tapsHostVascular: false,
      trapsInsects: true,
    })),
    Match.when("parasitic", () => ({
      hasChlorophyll: false,
      tapsHostVascular: true,
      trapsInsects: false,
    })),
    Match.when("epiphytic", () => ({
      hasChlorophyll: true,
      tapsHostVascular: false,
      trapsInsects: false,
    })),
    Match.exhaustive
  );
}
