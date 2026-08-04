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

type TryoutAttempt = Doc<"tryoutAttempts">;

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
  const section = requestedSection ?? (yield* loadActiveSection(ctx, attempt));
  if (!section) {
    return noContentAccess;
  }

  const access = getTryoutSectionContentAccess(attempt.status, section.status);
  if (!access.questions) {
    return noContentAccess;
  }

  const snapshotId = attempt.tryoutSnapshotId;
  if (!snapshotId) {
    const filesystemAccess: Extract<
      TryoutSectionContentAccess,
      { kind: "filesystem" }
    > = { ...access, kind: "filesystem" };
    return filesystemAccess;
  }
  const snapshotReleaseId = attempt.snapshotReleaseId;
  if (!snapshotReleaseId) {
    return yield* contentIntegrity(
      "Signed try-out attempt lost its frozen release identity."
    );
  }

  return yield* loadTryoutSignedContent({
    access,
    attempt,
    ctx,
    locale: args.locale,
    sectionKey: section.sectionKey,
    snapshotReleaseId,
    snapshotId,
    totalQuestions: section.totalQuestions,
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
    const attemptIdentity = yield* readAttemptSetIdentity(ctx, attempt);
    if (!(attemptIdentity && matchesAttemptIdentity(attemptIdentity, args))) {
      return yield* contentIntegrity(
        "Try-out content request differs from its frozen attempt identity."
      );
    }
    return attempt;
  }
);

/** Resolves one bounded active section when its published route key changed. */
const loadActiveSection = Effect.fn("tryouts.access.loadActiveSection")(
  function* (ctx: QueryCtx, attempt: TryoutAttempt) {
    if (attempt.status !== "in-progress") {
      return null;
    }

    const sections = yield* tryContentPromise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (index) =>
          index.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.sectionSnapshots.length + 1)
    );
    if (sections.length > attempt.sectionSnapshots.length) {
      return yield* contentIntegrity(
        "Try-out section attempt count exceeds its frozen snapshot."
      );
    }

    return sections.find((section) => section.status === "in-progress") ?? null;
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
