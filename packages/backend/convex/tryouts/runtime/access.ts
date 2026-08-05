import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutSectionContentAccess,
  type TryoutSectionContentAccess,
  type TryoutSectionContentArgs,
} from "@repo/backend/convex/tryouts/runtime/content";
import {
  matchesAttemptIdentity,
  readAttemptSetIdentity,
  readOwnedAttemptById,
  readRouteAttempt,
} from "@repo/backend/convex/tryouts/runtime/lookup";
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

/** Resolves content access from the current user's latest owned attempt. */
export const readTryoutSectionContent = Effect.fn(
  "tryouts.access.readSectionContent"
)(function* (ctx: QueryCtx, args: TryoutSectionContentArgs) {
  const auth = yield* tryContentPromise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return noContentAccess;
  }

  const attempt = yield* readContentAttempt(ctx, args, auth.appUser._id);
  if (!attempt) {
    return noContentAccess;
  }

  const requestedSection = yield* tryContentPromise(() =>
    ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (index) =>
        index
          .eq("tryoutAttemptId", attempt._id)
          .eq("sectionKey", args.sectionKey)
      )
      .unique()
  );
  if (!requestedSection) {
    return noContentAccess;
  }

  const access = getTryoutSectionContentAccess(
    attempt.status,
    requestedSection.status
  );
  if (!access.questions) {
    return noContentAccess;
  }

  return yield* loadTryoutSignedContent({
    access,
    attempt,
    ctx,
    locale: args.locale,
    sectionKey: requestedSection.sectionKey,
    snapshotReleaseId: attempt.snapshotReleaseId,
    snapshotId: attempt.tryoutSnapshotId,
    totalQuestions: requestedSection.totalQuestions,
  });
});

/** Resolves either one route-bound attempt or the latest logical set attempt. */
const readContentAttempt = Effect.fn("tryouts.access.readContentAttempt")(
  function* (
    ctx: QueryCtx,
    args: TryoutSectionContentArgs,
    userId: Doc<"users">["_id"]
  ) {
    const attemptId = args.attemptId;
    if (!attemptId) {
      return yield* readRouteAttempt(ctx, args, userId);
    }

    const attempt = yield* readOwnedAttemptById(ctx, attemptId, userId);
    if (!attempt) {
      return null;
    }
    const attemptIdentity = readAttemptSetIdentity(attempt);
    if (!matchesAttemptIdentity(attemptIdentity, args)) {
      return yield* contentIntegrity(
        "Try-out content request differs from its frozen attempt identity."
      );
    }
    return attempt;
  }
);

/** Creates one typed fail-closed content integrity error. */
function contentIntegrity(message: string) {
  return new TryoutContentReadError({
    code: "TRYOUT_CONTENT_INTEGRITY",
    message,
  });
}

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
