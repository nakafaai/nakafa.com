import { Match, Schema } from "effect";

const PcaSubspaceSchema = Schema.Literals(["pc1Line", "pc1Pc2Plane", "full3D"]);

export type PcaSubspace = typeof PcaSubspaceSchema.Type;

const PcaMetricsSchema = Schema.Struct({
  pc1Share: Schema.Finite,
  pc2Share: Schema.Finite,
  reconstructionMse: Schema.Finite,
  varianceExplainedPercent: Schema.Finite,
});

/** Compute variance explained and squared reconstruction error for 3D PCA subspaces. */
export function evaluatePcaProjection(
  subspace: PcaSubspace,
  correlation: number
): typeof PcaMetricsSchema.Type {
  const r = Math.min(0.98, Math.max(0.05, correlation));
  const pc1 = 0.52 + 0.4 * r;
  const pc2 = (1 - pc1) * 0.72;
  const pc3 = Math.max(0, 1 - pc1 - pc2);

  return Match.value(subspace).pipe(
    Match.when("pc1Line", () => ({
      pc1Share: Number((pc1 * 100).toFixed(1)),
      pc2Share: Number((pc2 * 100).toFixed(1)),
      reconstructionMse: Number(((pc2 + pc3) * 1.4).toFixed(3)),
      varianceExplainedPercent: Number((pc1 * 100).toFixed(1)),
    })),
    Match.when("pc1Pc2Plane", () => ({
      pc1Share: Number((pc1 * 100).toFixed(1)),
      pc2Share: Number((pc2 * 100).toFixed(1)),
      reconstructionMse: Number((pc3 * 1.4).toFixed(3)),
      varianceExplainedPercent: Number(((pc1 + pc2) * 100).toFixed(1)),
    })),
    Match.when("full3D", () => ({
      pc1Share: Number((pc1 * 100).toFixed(1)),
      pc2Share: Number((pc2 * 100).toFixed(1)),
      reconstructionMse: 0,
      varianceExplainedPercent: 100,
    })),
    Match.exhaustive
  );
}
