import { Match, Schema } from "effect";

const CultureSolutionSchema = Schema.Literals([
  "complete",
  "noNitrogen",
  "noPhosphorus",
  "noPotassium",
  "noMagnesium",
]);

export type CultureSolution = typeof CultureSolutionSchema.Type;

const CultureGrowthSchema = Schema.Struct({
  chlorosisIndex: Schema.Finite,
  leafScale: Schema.Finite,
  rootLength: Schema.Finite,
  stemHeight: Schema.Finite,
});

/** Evaluate seedling morphology in Knop's culture solution by omitted mineral. */
export function evaluateCultureGrowth(
  solution: CultureSolution
): typeof CultureGrowthSchema.Type {
  return Match.value(solution).pipe(
    Match.when("complete", () => ({
      chlorosisIndex: 0,
      leafScale: 1,
      rootLength: 1,
      stemHeight: 1,
    })),
    Match.when("noNitrogen", () => ({
      chlorosisIndex: 0.9,
      leafScale: 0.58,
      rootLength: 0.72,
      stemHeight: 0.55,
    })),
    Match.when("noPhosphorus", () => ({
      chlorosisIndex: 0.35,
      leafScale: 0.64,
      rootLength: 0.42,
      stemHeight: 0.62,
    })),
    Match.when("noPotassium", () => ({
      chlorosisIndex: 0.65,
      leafScale: 0.72,
      rootLength: 0.68,
      stemHeight: 0.65,
    })),
    Match.when("noMagnesium", () => ({
      chlorosisIndex: 0.8,
      leafScale: 0.76,
      rootLength: 0.8,
      stemHeight: 0.78,
    })),
    Match.exhaustive
  );
}
