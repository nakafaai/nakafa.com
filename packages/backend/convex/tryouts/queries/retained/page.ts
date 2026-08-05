import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { readTryoutDestinationPaths } from "@repo/backend/convex/tryouts/catalog/destination";
import {
  readRetainedSectionPage,
  readRetainedSetPage,
} from "@repo/backend/convex/tryouts/queries/retained/snapshot";
import {
  readAttemptSetIdentity,
  readLatestAttemptByPath,
  readOwnedAttemptById,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect } from "effect";

/** Resolves an exact frozen set or the current route's in-progress attempt. */
export const readAttemptSetPage = Effect.fn(
  "tryouts.retained.readAttemptSetPage"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly attemptId?: string;
    readonly locale: "en" | "id";
    readonly publicPath: string;
  }
) {
  const auth = yield* Effect.promise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }
  const attempt = yield* readSetAttempt(ctx, args, auth.appUser._id);
  if (!attempt?.setPublicPath) {
    return null;
  }
  if (args.attemptId && attempt.setPublicPath !== args.publicPath) {
    return null;
  }
  if (!args.attemptId && attempt.status !== "in-progress") {
    return null;
  }
  const identity = readAttemptSetIdentity(attempt);
  if (identity.locale !== args.locale) {
    return null;
  }
  const page = yield* readRetainedSetPage(
    ctx,
    { locale: args.locale, publicPath: attempt.setPublicPath },
    attempt,
    identity
  );
  if (!page) {
    return null;
  }

  const activePaths = yield* readTryoutDestinationPaths(ctx, identity);
  return {
    activeSetPublicPath: activePaths.activeSetPublicPath,
    attemptId: attempt._id,
    page,
  };
});

/** Selects an exact attempt or the newest attempt for the active route identity. */
const readSetAttempt = Effect.fn("tryouts.retained.readSetAttempt")(function* (
  ctx: QueryCtx,
  args: {
    readonly attemptId?: string;
    readonly locale: "en" | "id";
    readonly publicPath: string;
  },
  userId: Doc<"users">["_id"]
) {
  if (args.attemptId) {
    const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
    if (!attemptId) {
      return null;
    }
    return yield* readOwnedAttemptById(ctx, attemptId, userId);
  }
  return yield* readLatestAttemptByPath(ctx, args, userId);
});

/** Resolves one frozen section without replacing it from the active catalog. */
export const readAttemptSectionPage = Effect.fn(
  "tryouts.retained.readAttemptSectionPage"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly attemptId?: string;
    readonly locale: "en" | "id";
    readonly publicPath: string;
  }
) {
  const auth = yield* Effect.promise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }
  const separator = args.publicPath.lastIndexOf("/");
  if (separator <= 0) {
    return null;
  }
  const setPublicPath = args.publicPath.slice(0, separator);
  const attempt = yield* readSectionAttempt(
    ctx,
    args,
    setPublicPath,
    auth.appUser._id
  );
  if (!attempt) {
    return null;
  }
  const identity = readAttemptSetIdentity(attempt);
  if (identity.locale !== args.locale) {
    return null;
  }
  if (!args.attemptId && attempt.status !== "in-progress") {
    return null;
  }
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.publicPath === args.publicPath
  );
  if (!snapshot) {
    return null;
  }
  const page = yield* readRetainedSectionPage(ctx, args, attempt);
  if (!page) {
    return null;
  }

  const activePaths = yield* readTryoutDestinationPaths(ctx, {
    ...identity,
    requestedSectionPublicPath: args.publicPath,
    sectionKey: snapshot.sectionKey,
  });
  if (!args.attemptId && activePaths.requestedSectionMatches === false) {
    return null;
  }

  return {
    activeSectionPublicPath: activePaths.activeSectionPublicPath,
    activeSetPublicPath: activePaths.activeSetPublicPath,
    attemptId: attempt._id,
    page,
  };
});

/** Selects an exact attempt or the newest attempt for one frozen set path. */
const readSectionAttempt = Effect.fn("tryouts.retained.readSectionAttempt")(
  function* (
    ctx: QueryCtx,
    args: {
      readonly attemptId?: string;
      readonly locale: "en" | "id";
    },
    setPublicPath: string,
    userId: Doc<"users">["_id"]
  ) {
    if (args.attemptId) {
      const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
      if (!attemptId) {
        return null;
      }
      return yield* readOwnedAttemptById(ctx, attemptId, userId);
    }
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex(
          "by_userId_and_locale_and_setPublicPath_and_startedAt",
          (index) =>
            index
              .eq("userId", userId)
              .eq("locale", args.locale)
              .eq("setPublicPath", setPublicPath)
        )
        .order("desc")
        .first()
    );
  }
);
