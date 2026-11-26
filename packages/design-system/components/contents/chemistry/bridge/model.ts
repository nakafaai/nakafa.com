import { Match, Schema } from "effect";

const GalvanicCellSchema = Schema.Literals([
  "daniell",
  "copperSilver",
  "magnesiumCopper",
]);

export type GalvanicCell = typeof GalvanicCellSchema.Type;

const CellSpecSchema = Schema.Struct({
  anodeSymbol: Schema.String,
  cathodeSymbol: Schema.String,
  electronSpeed: Schema.Finite,
  emfVolts: Schema.Finite,
});

/** Evaluate standard cell EMF and electron-drift speed for a galvanic pair. */
export function evaluateGalvanicCell(
  cell: GalvanicCell
): typeof CellSpecSchema.Type {
  return Match.value(cell).pipe(
    Match.when("daniell", () => ({
      anodeSymbol: "Zn",
      cathodeSymbol: "Cu",
      electronSpeed: 1.1,
      emfVolts: 1.1,
    })),
    Match.when("copperSilver", () => ({
      anodeSymbol: "Cu",
      cathodeSymbol: "Ag",
      electronSpeed: 0.65,
      emfVolts: 0.46,
    })),
    Match.when("magnesiumCopper", () => ({
      anodeSymbol: "Mg",
      cathodeSymbol: "Cu",
      electronSpeed: 1.8,
      emfVolts: 2.71,
    })),
    Match.exhaustive
  );
}
