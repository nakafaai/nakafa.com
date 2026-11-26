import { Match, Schema } from "effect";

const SynthesisRouteSchema = Schema.Literals([
  "addition",
  "substitution",
  "elimination",
  "fermentation",
]);

export type SynthesisRoute = typeof SynthesisRouteSchema.Type;

const AtomEconomySchema = Schema.Struct({
  economyPercent: Schema.Int,
  productSpheres: Schema.Int,
  wasteSpheres: Schema.Int,
});

/** Evaluate green-chemistry atom economy percentage and product vs waste atom split. */
export function evaluateAtomEconomy(
  route: SynthesisRoute
): typeof AtomEconomySchema.Type {
  return Match.value(route).pipe(
    Match.when("addition", () => ({
      economyPercent: 100,
      productSpheres: 8,
      wasteSpheres: 0,
    })),
    Match.when("substitution", () => ({
      economyPercent: 58,
      productSpheres: 5,
      wasteSpheres: 3,
    })),
    Match.when("elimination", () => ({
      economyPercent: 61,
      productSpheres: 5,
      wasteSpheres: 3,
    })),
    Match.when("fermentation", () => ({
      economyPercent: 51,
      productSpheres: 4,
      wasteSpheres: 4,
    })),
    Match.exhaustive
  );
}
