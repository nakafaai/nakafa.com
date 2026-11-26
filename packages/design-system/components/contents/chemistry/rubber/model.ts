import { Schema } from "effect";

const RubberStateSchema = Schema.Literals(["naturalLatex", "vulcanisedRubber"]);

export type RubberState = typeof RubberStateSchema.Type;

const RubberMechanicsSchema = Schema.Struct({
  chainSlip: Schema.Finite,
  crosslinked: Schema.Boolean,
  elasticRecoveryPercent: Schema.Int,
});

/** Model polyisoprene chain slip vs sulfur-crosslink elastic recovery under stretch. */
export function evaluateRubberStretch(
  state: RubberState,
  stretchPercent: number
): typeof RubberMechanicsSchema.Type {
  const s = Math.min(100, Math.max(0, stretchPercent)) / 100;
  if (state === "vulcanisedRubber") {
    return {
      chainSlip: Number((s * 0.08).toFixed(3)),
      crosslinked: true,
      elasticRecoveryPercent: 96,
    };
  }
  return {
    chainSlip: Number((s * 0.45).toFixed(3)),
    crosslinked: false,
    elasticRecoveryPercent: Math.round(62 - s * 38),
  };
}
