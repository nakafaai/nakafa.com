import { Array as Arr, Match, Schema } from "effect";

const DihybridFilterSchema = Schema.Literals([
  "all",
  "dominantBoth",
  "recombinants",
  "recessiveBoth",
]);

export type DihybridFilter = typeof DihybridFilterSchema.Type;

const SeedPhenotypeSchema = Schema.Literals([
  "roundYellow",
  "roundGreen",
  "wrinkledYellow",
  "wrinkledGreen",
]);

type SeedPhenotype = typeof SeedPhenotypeSchema.Type;

const DihybridCellSchema = Schema.Struct({
  col: Schema.Int,
  highlighted: Schema.Boolean,
  id: Schema.String,
  phenotype: SeedPhenotypeSchema,
  row: Schema.Int,
});

const GAMETES = [
  { r: true, y: true },
  { r: true, y: false },
  { r: false, y: true },
  { r: false, y: false },
] as const;

function classifySeed(round: boolean, yellow: boolean): SeedPhenotype {
  if (round && yellow) {
    return "roundYellow";
  }
  if (round) {
    return "roundGreen";
  }
  if (yellow) {
    return "wrinkledYellow";
  }
  return "wrinkledGreen";
}

function matchesFilter(
  phenotype: SeedPhenotype,
  filter: DihybridFilter
): boolean {
  return Match.value(filter).pipe(
    Match.when("all", () => true),
    Match.when("dominantBoth", () => phenotype === "roundYellow"),
    Match.when(
      "recombinants",
      () => phenotype === "roundGreen" || phenotype === "wrinkledYellow"
    ),
    Match.when("recessiveBoth", () => phenotype === "wrinkledGreen"),
    Match.exhaustive
  );
}

/** Build the 16 cells of the RrYy x RrYy 4x4 Punnett cube with filter highlighting. */
export function evaluateDihybridGrid(
  filter: DihybridFilter
): readonly (typeof DihybridCellSchema.Type)[] {
  return Arr.flatMap(GAMETES, (rowGamete, row) =>
    Arr.map(GAMETES, (colGamete, col) => {
      const phenotype = classifySeed(
        rowGamete.r || colGamete.r,
        rowGamete.y || colGamete.y
      );
      return {
        col,
        highlighted: matchesFilter(phenotype, filter),
        id: `d-${row}-${col}`,
        phenotype,
        row,
      };
    })
  );
}
