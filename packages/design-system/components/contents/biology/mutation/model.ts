import { Match, Schema } from "effect";

const MutationKindSchema = Schema.Literals([
  "deletion",
  "duplication",
  "inversion",
  "translocation",
  "nondisjunction",
]);

export type MutationKind = typeof MutationKindSchema.Type;

const ChromosomeBandSchema = Schema.Struct({
  code: Schema.Literals(["A", "B", "C", "D"]),
  highlighted: Schema.Boolean,
  id: Schema.String,
});

const MutationProfileSchema = Schema.Struct({
  bands: Schema.Array(ChromosomeBandSchema),
  copyCount: Schema.Int,
  hasNonHomologue: Schema.Boolean,
});

/** Model chromosomal band order and copy number for each structural or numerical mutation. */
export function evaluateChromosomeMutation(
  mutation: MutationKind
): typeof MutationProfileSchema.Type {
  return Match.value(mutation).pipe(
    Match.when("deletion", () => ({
      bands: [
        { code: "A" as const, highlighted: false, id: "b-0" },
        { code: "C" as const, highlighted: true, id: "b-1" },
        { code: "D" as const, highlighted: false, id: "b-2" },
      ],
      copyCount: 2,
      hasNonHomologue: false,
    })),
    Match.when("duplication", () => ({
      bands: [
        { code: "A" as const, highlighted: false, id: "b-0" },
        { code: "B" as const, highlighted: true, id: "b-1" },
        { code: "B" as const, highlighted: true, id: "b-2" },
        { code: "C" as const, highlighted: false, id: "b-3" },
        { code: "D" as const, highlighted: false, id: "b-4" },
      ],
      copyCount: 2,
      hasNonHomologue: false,
    })),
    Match.when("inversion", () => ({
      bands: [
        { code: "A" as const, highlighted: false, id: "b-0" },
        { code: "C" as const, highlighted: true, id: "b-1" },
        { code: "B" as const, highlighted: true, id: "b-2" },
        { code: "D" as const, highlighted: false, id: "b-3" },
      ],
      copyCount: 2,
      hasNonHomologue: false,
    })),
    Match.when("translocation", () => ({
      bands: [
        { code: "A" as const, highlighted: false, id: "b-0" },
        { code: "B" as const, highlighted: false, id: "b-1" },
        { code: "D" as const, highlighted: true, id: "b-2" },
      ],
      copyCount: 2,
      hasNonHomologue: true,
    })),
    Match.when("nondisjunction", () => ({
      bands: [
        { code: "A" as const, highlighted: false, id: "b-0" },
        { code: "B" as const, highlighted: false, id: "b-1" },
        { code: "C" as const, highlighted: false, id: "b-2" },
        { code: "D" as const, highlighted: false, id: "b-3" },
      ],
      copyCount: 3,
      hasNonHomologue: false,
    })),
    Match.exhaustive
  );
}
