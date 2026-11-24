import { Schema } from "effect";

const RingModeSchema = Schema.Literals(["intact", "ringed"]);

export type RingMode = typeof RingModeSchema.Type;

const PhloemFlowSchema = Schema.Struct({
  bulgeScale: Schema.Finite,
  flowRate: Schema.Finite,
  pressureMpa: Schema.Finite,
});

/**
 * Evaluate Munch pressure-flow gradient and upper-ring swelling
 * across intact versus bark-ringed phloem stems.
 */
export function evaluatePhloemFlow(
  mode: RingMode,
  sourceSucrose: number
): typeof PhloemFlowSchema.Type {
  const s = Math.min(100, Math.max(0, sourceSucrose));
  const pressureMpa = Number((0.25 + (s / 100) * 1.35).toFixed(2));
  if (mode === "ringed") {
    return {
      bulgeScale: Number((1.15 + (s / 100) * 0.5).toFixed(2)),
      flowRate: 0.15,
      pressureMpa,
    };
  }
  return {
    bulgeScale: 1,
    flowRate: Number((0.4 + (s / 100) * 1.1).toFixed(2)),
    pressureMpa,
  };
}
