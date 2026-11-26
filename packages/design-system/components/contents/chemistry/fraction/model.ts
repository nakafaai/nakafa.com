import { Match, Schema } from "effect";

const PetroleumFractionSchema = Schema.Literals([
  "refineryGas",
  "petrol",
  "kerosene",
  "diesel",
  "bitumen",
]);

export type PetroleumFraction = typeof PetroleumFractionSchema.Type;

const FractionLevelSchema = Schema.Struct({
  boilingC: Schema.Int,
  chainLength: Schema.String,
  trayY: Schema.Finite,
});

/** Return condensing tray height, boiling point, and carbon chain length in a fractionating column. */
export function evaluatePetroleumFraction(
  fraction: PetroleumFraction
): typeof FractionLevelSchema.Type {
  return Match.value(fraction).pipe(
    Match.when("refineryGas", () => ({
      boilingC: 25,
      chainLength: "C1-C4",
      trayY: 1.08,
    })),
    Match.when("petrol", () => ({
      boilingC: 110,
      chainLength: "C5-C10",
      trayY: 0.88,
    })),
    Match.when("kerosene", () => ({
      boilingC: 200,
      chainLength: "C11-C14",
      trayY: 0.68,
    })),
    Match.when("diesel", () => ({
      boilingC: 300,
      chainLength: "C15-C20",
      trayY: 0.48,
    })),
    Match.when("bitumen", () => ({
      boilingC: 380,
      chainLength: "> C35",
      trayY: 0.24,
    })),
    Match.exhaustive
  );
}
