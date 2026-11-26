import { Match, Schema } from "effect";

const QuadratOrganismSchema = Schema.Literals(["clover", "fern", "moss"]);

export type QuadratOrganism = typeof QuadratOrganismSchema.Type;

const SamplingMethodSchema = Schema.Literals(["random", "beltTransect"]);

export type SamplingMethod = typeof SamplingMethodSchema.Type;

const QuadratEstimateSchema = Schema.Struct({
  coveragePercent: Schema.Finite,
  densityPerSqM: Schema.Finite,
  sampledPlots: Schema.Int,
});

/** Estimate species density and percentage ground cover from quadrat sampling parameters. */
export function evaluateQuadratSampling(
  organism: QuadratOrganism,
  method: SamplingMethod,
  quadratCount: number
): typeof QuadratEstimateSchema.Type {
  const n = Math.max(1, Math.round(quadratCount));
  const methodFactor = method === "random" ? 1 : 0.92;
  const stability = 1 + 0.08 / Math.sqrt(n);

  return Match.value(organism).pipe(
    Match.when("clover", () => ({
      coveragePercent: Math.round(52 * methodFactor * stability),
      densityPerSqM: Number((12.4 * methodFactor * stability).toFixed(1)),
      sampledPlots: n,
    })),
    Match.when("fern", () => ({
      coveragePercent: Math.round(36 * methodFactor * stability),
      densityPerSqM: Number((5.2 * methodFactor * stability).toFixed(1)),
      sampledPlots: n,
    })),
    Match.when("moss", () => ({
      coveragePercent: Math.round(68 * methodFactor * stability),
      densityPerSqM: Number((18.5 * methodFactor * stability).toFixed(1)),
      sampledPlots: n,
    })),
    Match.exhaustive
  );
}
