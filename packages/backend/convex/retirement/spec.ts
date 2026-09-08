import schema from "@repo/backend/convex/schema";
import { convexToJson, type Infer, type Value, v } from "convex/values";
import { Effect, Schema } from "effect";

export const REVIEWED_ATTEMPT_ID = "wn7d0a14z2wscs0kpmgx7k7psh8e0x0t";

export const planValidator = v.object({
  active: v.object({
    releaseId: v.string(),
    manifestHash: v.string(),
    sequence: v.number(),
  }),
  newSnapshotId: v.string(),
  attempt: schema.doc("tryoutAttempts"),
  section: schema.doc("tryoutSectionAttempts"),
  progress: schema.doc("tryoutSetProgress"),
  previous: schema.doc("tryoutAttempts"),
  previousScore: schema.doc("tryoutScores"),
  scale: schema.doc("irtScaleVersions"),
  sharedAttempts: v.array(schema.doc("tryoutAttempts")),
});
export type Plan = Infer<typeof planValidator>;

/** Refuses retirement when the reviewed empty-attempt proof no longer holds. */
export class EmptyAttemptRetirementError extends Schema.TaggedError<EmptyAttemptRetirementError>()(
  "EmptyAttemptRetirementError",
  {
    code: Schema.Literal("TRYOUT_EMPTY_RETIREMENT_REFUSED"),
    message: Schema.String,
  }
) {}

/** Compares validated Convex documents through its canonical sorted-key codec. */
export function sameDocument(actual: Value, expected: Value) {
  return (
    JSON.stringify(convexToJson(actual)) ===
    JSON.stringify(convexToJson(expected))
  );
}

/** Keeps every reviewed precondition in the typed retirement failure channel. */
export const requireProof = Effect.fn("retirement.requireProof")(function* (
  condition: boolean,
  message: string
) {
  if (!condition) {
    return yield* new EmptyAttemptRetirementError({
      code: "TRYOUT_EMPTY_RETIREMENT_REFUSED",
      message,
    });
  }
});
