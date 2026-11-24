import { Match, Schema } from "effect";

const FruitTypeSchema = Schema.Literals(["simple", "aggregate", "multiple"]);

export type FruitType = typeof FruitTypeSchema.Type;

const FruitGeometrySchema = Schema.Struct({
  carpelCount: Schema.Int,
  flowerCount: Schema.Int,
});

/** Characterise carpel and flower origins across simple, aggregate, and multiple fruits. */
export function evaluateFruitOrigin(
  fruit: FruitType
): typeof FruitGeometrySchema.Type {
  return Match.value(fruit).pipe(
    Match.when("simple", () => ({ carpelCount: 1, flowerCount: 1 })),
    Match.when("aggregate", () => ({ carpelCount: 6, flowerCount: 1 })),
    Match.when("multiple", () => ({ carpelCount: 8, flowerCount: 8 })),
    Match.exhaustive
  );
}
