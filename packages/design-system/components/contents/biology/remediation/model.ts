import { Match, Schema } from "effect";

const RemediationPlantSchema = Schema.Literals([
  "mustard",
  "hyacinth",
  "vetiver",
]);

export type RemediationPlant = typeof RemediationPlantSchema.Type;

const RemediationReadingSchema = Schema.Struct({
  isAquatic: Schema.Boolean,
  remainingPercent: Schema.Int,
  removedPerCycle: Schema.Finite,
});

/**
 * Evaluate remaining heavy-metal pollutant fraction after repeated
 * hyperaccumulator harvest cycles.
 */
export function evaluatePhytoremediation(
  plant: RemediationPlant,
  harvests: number
): typeof RemediationReadingSchema.Type {
  const cycles = Math.max(0, Math.round(harvests));
  const removedPerCycle = Match.value(plant).pipe(
    Match.when("mustard", () => 0.28),
    Match.when("hyacinth", () => 0.34),
    Match.when("vetiver", () => 0.25),
    Match.exhaustive
  );
  const remaining = Math.round(100 * (1 - removedPerCycle) ** cycles);
  return {
    isAquatic: plant === "hyacinth",
    remainingPercent: Math.max(5, remaining),
    removedPerCycle,
  };
}
