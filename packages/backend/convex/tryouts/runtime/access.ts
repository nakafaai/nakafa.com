import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  getTryoutSectionContentAccess,
  type TryoutSectionContentAccess,
} from "@repo/backend/convex/tryouts/runtime/content";
import { readAttemptSetIdentity } from "@repo/backend/convex/tryouts/runtime/lookup";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { Effect, Schema } from "effect";

const noContentAccess: Extract<TryoutSectionContentAccess, { kind: "none" }> = {
  kind: "none",
};

/** Stable failure while reading one attempt-owned content capability. */
class TryoutContentReadError extends Schema.TaggedError<TryoutContentReadError>()(
  "TryoutContentReadError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_CONTENT_INTEGRITY"),
    message: Schema.String,
  }
) {}

/** Resolves content from an attempt already authenticated by its route query. */
export const readOwnedTryoutSectionContent = Effect.fn(
  "tryouts.access.readOwnedSectionContent"
)(function* (
  ctx: QueryCtx,
  input: {
    readonly attempt: Doc<"tryoutAttempts">;
    readonly appLocale: Doc<"tryoutAttempts">["appLocale"];
    readonly sectionKey: Doc<"tryoutSectionAttempts">["sectionKey"];
  }
) {
  const requestedSection = yield* tryContentPromise(() =>
    ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (index) =>
        index
          .eq("tryoutAttemptId", input.attempt._id)
          .eq("sectionKey", input.sectionKey)
      )
      .unique()
  );
  if (!requestedSection) {
    return noContentAccess;
  }

  const access = getTryoutSectionContentAccess(
    input.attempt.status,
    requestedSection.status
  );
  if (!access.questions) {
    return noContentAccess;
  }

  const identity = readAttemptSetIdentity(input.attempt);
  if (identity.locale !== input.appLocale) {
    return yield* new TryoutContentReadError({
      code: "TRYOUT_CONTENT_INTEGRITY",
      message: "Try-out content locale differs from its attempt.",
    });
  }
  return yield* loadTryoutSignedContent({
    answers: access.answers,
    attempt: input.attempt,
    ctx,
    appLocale: identity.locale,
    sectionKey: requestedSection.sectionKey,
    snapshotReleaseId: input.attempt.snapshotReleaseId,
    snapshotId: input.attempt.tryoutSnapshotId,
    totalQuestions: requestedSection.totalQuestions,
  });
});

/** Lifts one Convex read into the typed content error channel. */
function tryContentPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      new TryoutContentReadError({
        cause,
        code: "TRYOUT_CONTENT_INTEGRITY",
        message: "Unable to read try-out content access.",
      }),
    try: operation,
  });
}
