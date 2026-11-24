import { Match, Schema } from "effect";

const PhytohormoneIdSchema = Schema.Literals([
  "auxin",
  "gibberellin",
  "cytokinin",
  "abscisicAcid",
  "ethylene",
]);

export type PhytohormoneId = typeof PhytohormoneIdSchema.Type;

const HormoneMorphologySchema = Schema.Struct({
  fruitRipeness: Schema.Finite,
  lateralBudScale: Schema.Finite,
  leafDroop: Schema.Finite,
  stemScale: Schema.Finite,
});

/** Evaluate whole-plant morphological response for each phytohormone. */
export function evaluatePhytohormone(
  hormone: PhytohormoneId
): typeof HormoneMorphologySchema.Type {
  return Match.value(hormone).pipe(
    Match.when("auxin", () => ({
      fruitRipeness: 0.25,
      lateralBudScale: 0.45,
      leafDroop: 0,
      stemScale: 1.15,
    })),
    Match.when("gibberellin", () => ({
      fruitRipeness: 0.35,
      lateralBudScale: 0.85,
      leafDroop: 0,
      stemScale: 1.45,
    })),
    Match.when("cytokinin", () => ({
      fruitRipeness: 0.2,
      lateralBudScale: 1.5,
      leafDroop: 0,
      stemScale: 1,
    })),
    Match.when("abscisicAcid", () => ({
      fruitRipeness: 0.3,
      lateralBudScale: 0.4,
      leafDroop: 0.5,
      stemScale: 0.82,
    })),
    Match.when("ethylene", () => ({
      fruitRipeness: 1,
      lateralBudScale: 0.75,
      leafDroop: 0.22,
      stemScale: 0.96,
    })),
    Match.exhaustive
  );
}
