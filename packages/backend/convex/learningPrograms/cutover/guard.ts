import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
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

/** Builds the one fail-closed error used while legacy profiles remain writable. */
function cutoverRequired(message: string) {
  return new LearningSelectionCutoverError({
    code: cutoverRequiredCode,
    message,
  });
}

/** Proves retained legacy state cannot supersede the canonical selection. */
export const requireLearningSelectionCutoverComplete = Effect.fn(
  "learningPrograms.requireLearningSelectionCutoverComplete"
)(function* (
  ctx: QueryCtx,
  userId: Id<"users">,
  preference: Doc<"learningPreferences"> | null
) {
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

  if (!profile) {
    return;
  }

  if (
    !(
      preference?.learningInterest &&
      preference.primaryProgramKey &&
      preference.selectionUpdatedAt !== undefined
    )
  ) {
    return yield* cutoverRequired(
      "A retained learning profile has no canonical selection."
    );
  }

  const legacyProgram = yield* Effect.tryPromise({
    catch: (error) =>
      new LearningSelectionCutoverError({
        code: cutoverReadFailedCode,
        message: getUnknownErrorMessage(error),
      }),
    try: () => ctx.db.get(profile.programId),
  });
  const profileProgramKey = profile.programKey;
  const storedProgramKey = legacyProgram?.key;

  if (
    profileProgramKey !== undefined &&
    storedProgramKey !== undefined &&
    profileProgramKey !== storedProgramKey
  ) {
    return yield* cutoverRequired(
      "A retained learning profile has conflicting program identities."
    );
  }

  const legacyProgramKey = profileProgramKey ?? storedProgramKey;
  const sameSelection =
    legacyProgramKey === preference.primaryProgramKey &&
    profile.interests.includes(preference.learningInterest);

  if (sameSelection) {
    return;
  }

  if (
    legacyProgramKey === undefined &&
    preference.selectionUpdatedAt >= profile.updatedAt
  ) {
    return;
  }

  if (preference.selectionUpdatedAt > profile.updatedAt) {
    return;
  }

  return yield* cutoverRequired(
    "A retained learning profile is not older than the canonical selection."
  );
});
