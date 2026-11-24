import { Match, Schema } from "effect";

const GlucoseStateSchema = Schema.Literals([
  "afterMeal",
  "normal",
  "fasting",
  "diabetes",
]);

export type GlucoseState = typeof GlucoseStateSchema.Type;

const HormoneIdSchema = Schema.Literals([
  "insulin",
  "glucagon",
  "balanced",
  "deficient",
]);

export type HormoneId = typeof HormoneIdSchema.Type;

const GlucoseFeedbackSchema = Schema.Struct({
  glycogenScale: Schema.Finite,
  hormone: HormoneIdSchema,
  vesselParticles: Schema.Int,
});

/** Evaluate pancreatic hormone response, liver glycogen store scale, and blood glucose load. */
export function evaluateGlucoseFeedback(
  state: GlucoseState,
  glucoseLevel: number
): typeof GlucoseFeedbackSchema.Type {
  const levelNorm = Math.min(1.8, Math.max(0.4, glucoseLevel / 100));
  return Match.value(state).pipe(
    Match.when("afterMeal", () => ({
      glycogenScale: 1.35,
      hormone: "insulin" as const,
      vesselParticles: Math.round(10 * levelNorm),
    })),
    Match.when("normal", () => ({
      glycogenScale: 1,
      hormone: "balanced" as const,
      vesselParticles: Math.round(6 * levelNorm),
    })),
    Match.when("fasting", () => ({
      glycogenScale: 0.6,
      hormone: "glucagon" as const,
      vesselParticles: Math.max(3, Math.round(4 * levelNorm)),
    })),
    Match.when("diabetes", () => ({
      glycogenScale: 0.5,
      hormone: "deficient" as const,
      vesselParticles: Math.round(14 * levelNorm),
    })),
    Match.exhaustive
  );
}
