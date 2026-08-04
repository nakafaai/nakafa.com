import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  readFilesystemDestinationPaths,
  readFilesystemSection,
} from "@repo/backend/convex/tryouts/catalog/filesystem/content";
import {
  readPublishedSection,
  readPublishedSet,
} from "@repo/backend/convex/tryouts/catalog/hierarchy";
import { readPublishedSectionPage } from "@repo/backend/convex/tryouts/catalog/published";
import {
  readRetainedSectionPage,
  readRetainedSetPage,
} from "@repo/backend/convex/tryouts/queries/retained/snapshot";
import { getActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  matchesAttemptIdentity,
  readAttemptSetIdentity,
  readOwnedAttemptById,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect } from "effect";

/** Resolves one exact frozen set without replacing it from the active catalog. */
export const readAttemptSetPage = Effect.fn(
  "tryouts.retained.readAttemptSetPage"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly attemptId: string;
    readonly locale: "en" | "id";
    readonly publicPath: string;
  }
) {
  const auth = yield* Effect.promise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }
  const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
  if (!attemptId) {
    return null;
  }
  const attempt = yield* readOwnedAttemptById(ctx, attemptId, auth.appUser._id);
  if (!attempt || attempt.setPublicPath !== args.publicPath) {
    return null;
  }
  const identity = yield* readAttemptSetIdentity(ctx, attempt);
  if (identity?.locale !== args.locale) {
    return null;
  }
  const page = yield* readRetainedSetPage(ctx, args, attempt, identity);
  if (!page) {
    return null;
  }

  const activeCatalog = yield* loadTryoutCatalog(ctx, args.locale);
  const activeSet = activeCatalog.managed
    ? yield* readPublishedSet(activeCatalog, identity)
    : yield* Effect.promise(() => getActiveTryoutSet(ctx, identity));
  return {
    activeSetPublicPath: activeSet?.publicPath ?? null,
    attemptId: attempt._id,
    page,
  };
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
  const identity = yield* readAttemptSetIdentity(ctx, attempt);
  if (identity?.locale !== args.locale) {
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
  const page = yield* readRetainedSectionPage(
    ctx,
    { ...args, setPublicPath },
    attempt,
    identity,
    snapshot
  );
  if (!page) {
    return null;
  }

  const activeCatalog = yield* loadTryoutCatalog(ctx, args.locale);
  if (!args.attemptId) {
    const activePage = activeCatalog.managed
      ? yield* readPublishedSectionPage(activeCatalog, args.publicPath)
      : yield* readFilesystemSection(ctx, args);
    if (activePage) {
      const activeIdentity = {
        countryKey: activePage.set.countryKey,
        examKey: activePage.set.examKey,
        locale: args.locale,
        setKey: activePage.set.setKey,
        trackKey: activePage.set.trackKey,
      };
      if (
        !matchesAttemptIdentity(identity, activeIdentity) ||
        activePage.section.sectionKey !== snapshot.sectionKey
      ) {
        return null;
      }
    }
  }

  const activeIdentity = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: args.locale,
    sectionKey: page.section.sectionKey,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  if (!activeCatalog.managed) {
    const activePaths = yield* readFilesystemDestinationPaths(
      ctx,
      activeIdentity
    );
    return { ...activePaths, attemptId: attempt._id, page };
  }
  const activeSet = yield* readPublishedSet(activeCatalog, activeIdentity);
  const activeSection = yield* readPublishedSection(
    activeCatalog,
    activeIdentity
  );
  return {
    activeSectionPublicPath: activeSection?.publicPath ?? null,
    activeSetPublicPath: activeSet?.publicPath ?? null,
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
