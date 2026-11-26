import { Match, Schema } from "effect";

const EnthalpyReactionSchema = Schema.Literals([
  "neutralisation",
  "displacement",
  "combustion",
  "dissolution",
]);

export type EnthalpyReaction = typeof EnthalpyReactionSchema.Type;

const CalorimeterReadingSchema = Schema.Struct({
  deltaHKjPerMol: Schema.Finite,
  exothermic: Schema.Boolean,
  tempChangeC: Schema.Finite,
});

/** Compute molar enthalpy change and solution temperature shift for 100 cm3 water. */
export function evaluateCalorimeter(
  reaction: EnthalpyReaction,
  moles: number
): typeof CalorimeterReadingSchema.Type {
  const n = Math.max(0.005, moles);
  const deltaH = Match.value(reaction).pipe(
    Match.when("neutralisation", () => -57.3),
    Match.when("displacement", () => -210),
    Match.when("combustion", () => -726),
    Match.when("dissolution", () => 25.7),
    Match.exhaustive
  );
  const heatJoules = -deltaH * 1000 * n;
  const tempChangeC = Number((heatJoules / (100 * 4.18)).toFixed(1));
  return {
    deltaHKjPerMol: deltaH,
    exothermic: deltaH < 0,
    tempChangeC,
  };
}
