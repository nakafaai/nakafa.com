import { Match, Schema } from "effect";

const ReflexTypeSchema = Schema.Literals(["withdrawal", "kneeJerk"]);

export type ReflexType = typeof ReflexTypeSchema.Type;

const ReflexProfileSchema = Schema.Struct({
  activeStage: Schema.Int,
  hasRelay: Schema.Boolean,
  synapseCount: Schema.Int,
});

/**
 * Evaluate synapse count, relay-neuron involvement, and active impulse stage
 * (0 = receptor, 1 = sensory, 2 = relay/cord, 3 = motor, 4 = effector).
 */
export function evaluateReflex(
  reflex: ReflexType,
  stepPercent: number
): typeof ReflexProfileSchema.Type {
  const clamped = Math.min(100, Math.max(0, stepPercent));
  const activeStage = Math.min(4, Math.floor((clamped / 100) * 5));
  return Match.value(reflex).pipe(
    Match.when("withdrawal", () => ({
      activeStage,
      hasRelay: true,
      synapseCount: 2,
    })),
    Match.when("kneeJerk", () => ({
      activeStage,
      hasRelay: false,
      synapseCount: 1,
    })),
    Match.exhaustive
  );
}
