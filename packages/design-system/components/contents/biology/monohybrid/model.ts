import { Match, Schema } from "effect";

const MonohybridCrossSchema = Schema.Literals([
  "pureF1",
  "heteroF2",
  "testCross",
]);

export type MonohybridCross = typeof MonohybridCrossSchema.Type;

const OffspringCellSchema = Schema.Struct({
  col: Schema.Int,
  genotype: Schema.Literals(["TT", "Tt", "tt"]),
  id: Schema.String,
  row: Schema.Int,
  tall: Schema.Boolean,
});

const CrossOutcomeSchema = Schema.Struct({
  cells: Schema.Array(OffspringCellSchema),
  parentAGametes: Schema.Tuple([Schema.String, Schema.String]),
  parentBGametes: Schema.Tuple([Schema.String, Schema.String]),
  tallCount: Schema.Int,
});

/** Compute the four Punnett-square genotypes and tall/dwarf counts for Mendel's monohybrid crosses. */
export function evaluateMonohybridCross(
  cross: MonohybridCross
): typeof CrossOutcomeSchema.Type {
  return Match.value(cross).pipe(
    Match.when("pureF1", () => ({
      cells: [
        { col: 0, genotype: "Tt" as const, id: "r0c0", row: 0, tall: true },
        { col: 1, genotype: "Tt" as const, id: "r0c1", row: 0, tall: true },
        { col: 0, genotype: "Tt" as const, id: "r1c0", row: 1, tall: true },
        { col: 1, genotype: "Tt" as const, id: "r1c1", row: 1, tall: true },
      ],
      parentAGametes: ["T", "T"] as const,
      parentBGametes: ["t", "t"] as const,
      tallCount: 4,
    })),
    Match.when("heteroF2", () => ({
      cells: [
        { col: 0, genotype: "TT" as const, id: "r0c0", row: 0, tall: true },
        { col: 1, genotype: "Tt" as const, id: "r0c1", row: 0, tall: true },
        { col: 0, genotype: "Tt" as const, id: "r1c0", row: 1, tall: true },
        { col: 1, genotype: "tt" as const, id: "r1c1", row: 1, tall: false },
      ],
      parentAGametes: ["T", "t"] as const,
      parentBGametes: ["T", "t"] as const,
      tallCount: 3,
    })),
    Match.when("testCross", () => ({
      cells: [
        { col: 0, genotype: "Tt" as const, id: "r0c0", row: 0, tall: true },
        { col: 1, genotype: "Tt" as const, id: "r0c1", row: 0, tall: true },
        { col: 0, genotype: "tt" as const, id: "r1c0", row: 1, tall: false },
        { col: 1, genotype: "tt" as const, id: "r1c1", row: 1, tall: false },
      ],
      parentAGametes: ["T", "t"] as const,
      parentBGametes: ["t", "t"] as const,
      tallCount: 2,
    })),
    Match.exhaustive
  );
}
