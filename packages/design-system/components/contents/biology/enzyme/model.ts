import { Match, Schema } from "effect";

const DisaccharidaseSchema = Schema.Literals(["lactase", "sucrase", "maltase"]);
export type Disaccharidase = typeof DisaccharidaseSchema.Type;

const DisaccharideSchema = Schema.Literals(["lactose", "sucrose", "maltose"]);
export type Disaccharide = typeof DisaccharideSchema.Type;

const BindingModelSchema = Schema.Literals(["lockKey", "inducedFit"]);
export type BindingModel = typeof BindingModelSchema.Type;

const MonosaccharideSchema = Schema.Literals([
  "glucose",
  "galactose",
  "fructose",
]);
export type Monosaccharide = typeof MonosaccharideSchema.Type;

const ReactionMatchSchema = Schema.Struct({
  fits: Schema.Boolean,
  products: Schema.Array(MonosaccharideSchema),
});
type ReactionMatch = typeof ReactionMatchSchema.Type;

/**
 * Checks enzyme-substrate specificity for the three disaccharidases and gives
 * the exact monosaccharide products of hydrolysis when the pair matches.
 */
export function reactionFor(
  enzyme: Disaccharidase,
  substrate: Disaccharide
): ReactionMatch {
  return Match.value(enzyme).pipe(
    Match.when("lactase", () =>
      substrate === "lactose"
        ? { fits: true, products: ["glucose", "galactose"] as const }
        : { fits: false, products: [] as const }
    ),
    Match.when("sucrase", () =>
      substrate === "sucrose"
        ? { fits: true, products: ["glucose", "fructose"] as const }
        : { fits: false, products: [] as const }
    ),
    Match.when("maltase", () =>
      substrate === "maltose"
        ? { fits: true, products: ["glucose", "glucose"] as const }
        : { fits: false, products: [] as const }
    ),
    Match.exhaustive
  );
}

/**
 * Computes the phase within one catalytic cycle (0 to 1):
 * 0.00-0.30 approach, 0.30-0.58 complex bound, 0.58-0.82 hydrolysis split,
 * 0.82-1.00 products depart while enzyme resets unchanged.
 */
export function cyclePhase(progress: number) {
  const t = ((progress % 1) + 1) % 1;
  if (t < 0.3) {
    return { bound: false, splitting: false, stage: "approach" as const, t };
  }
  if (t < 0.58) {
    return { bound: true, splitting: false, stage: "complex" as const, t };
  }
  if (t < 0.82) {
    return { bound: false, splitting: true, stage: "release" as const, t };
  }
  return { bound: false, splitting: false, stage: "reset" as const, t };
}
