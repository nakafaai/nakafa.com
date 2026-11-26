import { Match, Schema } from "effect";

const CatalysisModeSchema = Schema.Literals([
  "stoichiometric",
  "homogeneous",
  "heterogeneous",
  "biocatalyst",
]);

export type CatalysisMode = typeof CatalysisModeSchema.Type;

const RecoveryReadingSchema = Schema.Struct({
  eFactor: Schema.Finite,
  recoveredPercent: Schema.Int,
  wasteHeight: Schema.Finite,
});

/** Evaluate E-factor waste load and catalyst recovery across repeated batch cycles. */
export function evaluateCatalystRecovery(
  mode: CatalysisMode,
  cycles: number
): typeof RecoveryReadingSchema.Type {
  const n = Math.max(1, Math.round(cycles));
  const base = Match.value(mode).pipe(
    Match.when("stoichiometric", () => ({ eBase: 6.5, recoveredPercent: 0 })),
    Match.when("homogeneous", () => ({ eBase: 1.8, recoveredPercent: 65 })),
    Match.when("heterogeneous", () => ({ eBase: 0.4, recoveredPercent: 95 })),
    Match.when("biocatalyst", () => ({ eBase: 0.25, recoveredPercent: 92 })),
    Match.exhaustive
  );
  const eFactor = Number(
    (base.eBase / (1 + (n - 1) * (base.recoveredPercent / 250))).toFixed(2)
  );
  const wasteHeight = Number(
    Math.min(0.8, 0.1 + (eFactor / 6.5) * 0.7).toFixed(2)
  );
  return {
    eFactor,
    recoveredPercent: base.recoveredPercent,
    wasteHeight,
  };
}
