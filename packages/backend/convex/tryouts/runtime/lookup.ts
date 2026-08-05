import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import { readPublishedSetByPath } from "@repo/backend/convex/tryouts/catalog/hierarchy";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

type UserId = Doc<"users">["_id"];
type TryoutAttempt = Doc<"tryoutAttempts">;

/** Signed set identity used to select one user's attempt history. */
export interface AttemptOwnerIdentity {
  readonly setIdentity: string;
  readonly userId: UserId;
}

interface PublicSetPath {
  readonly locale: TryoutSetIdentity["locale"];
  readonly publicPath: string;
}

interface AttemptRouteSelector extends TryoutSetIdentity {
  readonly attemptId?: Id<"tryoutAttempts">;
  readonly sectionKey?: string;
}

/** Reads one bounded attempt set through its immutable signed identity. */
export const readOwnedAttempts = Effect.fn("tryouts.runtime.readOwnedAttempts")(
  function* (ctx: QueryCtx, owner: AttemptOwnerIdentity, limit: number) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_setIdentity_and_startedAt", (index) =>
          index.eq("userId", owner.userId).eq("setIdentity", owner.setIdentity)
        )
        .order("desc")
        .take(limit)
    );
  }
);

/** Reads the newest attempt for one user and signed set. */
export const readLatestOwnedAttempt = Effect.fn(
  "tryouts.runtime.readLatestOwnedAttempt"
)(function* (ctx: QueryCtx, owner: AttemptOwnerIdentity) {
  const attempts = yield* readOwnedAttempts(ctx, owner, 1);
  return attempts.at(0) ?? null;
});

/** Reads the newest attempt through its stable signed catalog identity. */
export const readLatestAttempt = Effect.fn("tryouts.runtime.readLatestAttempt")(
  function* (ctx: QueryCtx, identity: TryoutSetIdentity, userId: UserId) {
    return yield* readLatestOwnedAttempt(ctx, {
      setIdentity: tryoutCatalogIdentity({
        countryKey: identity.countryKey,
        examKey: identity.examKey,
        kind: "set",
        locale: identity.locale,
        setKey: identity.setKey,
        trackKey: identity.trackKey,
      }),
      userId,
    });
  }
);

/** Reads one exact attempt only when it belongs to the current app user. */
export const readOwnedAttemptById = Effect.fn(
  "tryouts.runtime.readOwnedAttemptById"
)(function* (ctx: QueryCtx, attemptId: Id<"tryoutAttempts">, userId: UserId) {
  const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));
  if (attempt?.userId !== userId) {
    return null;
  }
  return attempt;
});

/** Reads the complete identity persisted on every signed attempt. */
export function readAttemptSetIdentity(
  attempt: TryoutAttempt
): TryoutSetIdentity {
  return {
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    locale: attempt.locale,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  };
}

/** Checks that route keys select one resolved logical set identity. */
export function matchesAttemptIdentity(
  attemptIdentity: TryoutSetIdentity,
  routeIdentity: TryoutSetIdentity
) {
  return (
    attemptIdentity.countryKey === routeIdentity.countryKey &&
    attemptIdentity.examKey === routeIdentity.examKey &&
    attemptIdentity.locale === routeIdentity.locale &&
    attemptIdentity.setKey === routeIdentity.setKey &&
    attemptIdentity.trackKey === routeIdentity.trackKey
  );
}

/** Reads an exact route-bound attempt or the latest logical set attempt. */
export const readRouteAttempt = Effect.fn("tryouts.runtime.readRouteAttempt")(
  function* (ctx: QueryCtx, selector: AttemptRouteSelector, userId: UserId) {
    const attemptId = selector.attemptId;
    if (!attemptId) {
      const attempt = yield* readLatestAttempt(ctx, selector, userId);
      if (selector.sectionKey && attempt?.status !== "in-progress") {
        return null;
      }
      return attempt;
    }

    const attempt = yield* readOwnedAttemptById(ctx, attemptId, userId);
    if (!attempt) {
      return null;
    }
    if (!matchesAttemptIdentity(readAttemptSetIdentity(attempt), selector)) {
      return null;
    }
    return attempt;
  }
);

/** Reads the latest attempt for one current or frozen public set route. */
export const readLatestAttemptByPath = Effect.fn(
  "tryouts.runtime.readLatestAttemptByPath"
)(function* (ctx: QueryCtx, path: PublicSetPath, userId: UserId) {
  const catalog = yield* loadTryoutCatalog(ctx, path.locale);
  const activeSet = yield* readPublishedSetByPath(catalog, path.publicPath);
  if (activeSet) {
    return yield* readLatestOwnedAttempt(ctx, {
      setIdentity: tryoutCatalogIdentity(activeSet),
      userId,
    });
  }

  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex(
        "by_userId_and_locale_and_setPublicPath_and_startedAt",
        (index) =>
          index
            .eq("userId", userId)
            .eq("locale", path.locale)
            .eq("setPublicPath", path.publicPath)
      )
      .order("desc")
      .first()
  );
});

/** Reads one bounded attempt history page through the active signed catalog. */
export const readAttemptHistoryPage = Effect.fn(
  "tryouts.runtime.readAttemptHistoryPage"
)(function* (
  ctx: QueryCtx,
  path: PublicSetPath,
  userId: UserId,
  pagination: PaginationOptions
) {
  const catalog = yield* loadTryoutCatalog(ctx, path.locale);
  const set = yield* readPublishedSetByPath(catalog, path.publicPath);
  if (!set) {
    return { continueCursor: "", isDone: true, page: [] };
  }
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_setIdentity_and_startedAt", (index) =>
        index.eq("userId", userId).eq("setIdentity", tryoutCatalogIdentity(set))
      )
      .order("desc")
      .paginate(pagination)
  );
});
