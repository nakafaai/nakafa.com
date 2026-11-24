import { Match, Schema } from "effect";

const MeiosisStageSchema = Schema.Literals([
  "crossingOver",
  "independentAssortment",
  "randomFertilisation",
]);

export type MeiosisStage = typeof MeiosisStageSchema.Type;

const MeiosisReadingSchema = Schema.Struct({
  combinationsLabel: Schema.String,
  gameteCombinations: Schema.Finite,
  zygoteCombinations: Schema.Finite,
});

/**
 * Compute haploid gamete combinations (2^n) and diploid zygote combinations (2^n x 2^n)
 * for `chromosomePairs` homologous pairs during meiosis and fertilisation.
 */
export function evaluateMeiosisCombinations(
  stage: MeiosisStage,
  chromosomePairs: number
): typeof MeiosisReadingSchema.Type {
  const n = Math.min(23, Math.max(1, Math.round(chromosomePairs)));
  const gameteCombinations = 2 ** n;
  const zygoteCombinations = gameteCombinations * gameteCombinations;
  const combinationsLabel = Match.value(stage).pipe(
    Match.when("crossingOver", () => `> 2^${n}`),
    Match.when("independentAssortment", () => `2^${n} = ${gameteCombinations}`),
    Match.when(
      "randomFertilisation",
      () => `2^${n} x 2^${n} = ${zygoteCombinations}`
    ),
    Match.exhaustive
  );
  return {
    combinationsLabel,
    gameteCombinations,
    zygoteCombinations,
  };
}
