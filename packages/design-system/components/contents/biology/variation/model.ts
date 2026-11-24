import { Array as Arr, Schema } from "effect";

const VariationKindSchema = Schema.Literals(["continuous", "discontinuous"]);

export type VariationKind = typeof VariationKindSchema.Type;

const HistogramBarSchema = Schema.Struct({
  height: Schema.Finite,
  id: Schema.String,
  x: Schema.Finite,
});

function binomialCoefficient(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

/**
 * Compute normalised 3D histogram bars for polygenic continuous variation
 * (binomial bell curve over 2*genePairs alleles) vs single-gene discrete categories.
 */
export function evaluateVariationBars(
  kind: VariationKind,
  genePairs: number
): readonly (typeof HistogramBarSchema.Type)[] {
  if (kind === "discontinuous") {
    const heights = [0.42, 0.78, 0.32, 0.92];
    return Arr.map(heights, (height, index) => ({
      height,
      id: `disc-${index}`,
      x: -0.75 + index * 0.5,
    }));
  }
  const n = Math.min(12, Math.max(2, Math.round(genePairs) * 2));
  const counts = Arr.makeBy(n + 1, (k) => binomialCoefficient(n, k));
  const peak = Arr.reduce(counts, 1, (acc, value) => Math.max(acc, value));
  return Arr.map(counts, (count, index) => ({
    height: Number((0.12 + (count / peak) * 0.88).toFixed(3)),
    id: `cont-${index}`,
    x: -0.95 + (index / n) * 1.9,
  }));
}
