import { Match, Schema } from "effect";

const BreathingPhaseSchema = Schema.Literals([
  "inhalation",
  "exhalation",
  "forcedExhalation",
]);

export type BreathingPhase = typeof BreathingPhaseSchema.Type;

const ThoraxStateSchema = Schema.Struct({
  alveolarPressureDeltaMmHg: Schema.Finite,
  diaphragmY: Schema.Finite,
  lungScale: Schema.Finite,
  volumeLiters: Schema.Finite,
});

/** Compute Boyle's-law thoracic volume, alveolar pressure delta, and diaphragm elevation. */
export function evaluateThoraxMechanics(
  phase: BreathingPhase,
  depthPercent: number
): typeof ThoraxStateSchema.Type {
  const f = Math.min(1, Math.max(0.1, depthPercent / 100));
  return Match.value(phase).pipe(
    Match.when("inhalation", () => ({
      alveolarPressureDeltaMmHg: Number((-2.5 * f).toFixed(1)),
      diaphragmY: 0.22 - 0.1 * f,
      lungScale: 1 + 0.22 * f,
      volumeLiters: Number((2.4 + 1.2 * f).toFixed(2)),
    })),
    Match.when("exhalation", () => ({
      alveolarPressureDeltaMmHg: Number((1.6 * f).toFixed(1)),
      diaphragmY: 0.26 + 0.08 * f,
      lungScale: 1 - 0.1 * f,
      volumeLiters: Number((2.4 - 0.45 * f).toFixed(2)),
    })),
    Match.when("forcedExhalation", () => ({
      alveolarPressureDeltaMmHg: Number((4.8 * f).toFixed(1)),
      diaphragmY: 0.3 + 0.14 * f,
      lungScale: 0.88 - 0.14 * f,
      volumeLiters: Number((2.1 - 0.75 * f).toFixed(2)),
    })),
    Match.exhaustive
  );
}
