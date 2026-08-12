import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

const cutoverReadFailedCode = "LEARNING_SELECTION_CUTOVER_READ_FAILED";
const cutoverRequiredCode = "LEARNING_SELECTION_CUTOVER_REQUIRED";

/** Expected failure while proving one learner no longer depends on old state. */
class LearningSelectionCutoverError extends Schema.TaggedError<LearningSelectionCutoverError>()(
  "LearningSelectionCutoverError",
  {
    code: Schema.Literal(cutoverReadFailedCode, cutoverRequiredCode),
    message: Schema.String,
  }
) {}

/** Prevents an unmigrated retained profile from looking like first-run state. */
export const requireLearningSelectionCutoverComplete = Effect.fn(
  "learningPrograms.requireLearningSelectionCutoverComplete"
)(function* (ctx: QueryCtx, userId: Id<"users">) {
  const profile = yield* Effect.tryPromise({
    catch: (error) =>
      new LearningSelectionCutoverError({
        code: cutoverReadFailedCode,
        message: getUnknownErrorMessage(error),
      }),
    try: () =>
      ctx.db
        .query("learningProfiles")
        .withIndex("by_userId", (index) => index.eq("userId", userId))
        .unique(),
  });

  if (profile) {
    return yield* new LearningSelectionCutoverError({
      code: cutoverRequiredCode,
      message: "A retained learning profile has not been migrated.",
    });
  }
});
