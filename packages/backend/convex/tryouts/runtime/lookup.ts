import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/status";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

type UserId = Doc<"users">["_id"];
type TryoutAttempt = Doc<"tryoutAttempts">;

/** Signed set identity used to select one user's attempt history. */
export interface AttemptOwnerIdentity {
  readonly setIdentity: string;
  readonly userId: UserId;
}

/** Reads one bounded attempt set through its immutable signed identity. */
export const readOwnedAttempts = Effect.fn("tryouts.runtime.readOwnedAttempts")(
  function* (ctx: QueryCtx, owner: AttemptOwnerIdentity, limit: number) {
    return yield* tryRuntimePromise(() =>
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
const readLatestOwnedAttempt = Effect.fn(
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

/**
 * Reads the latest attempt through the compact current-set progress row.
 * @see https://docs.convex.dev/database/reading-data/indexes/
 */
export const readLatestProgressAttempt = Effect.fn(
  "tryouts.runtime.readLatestProgressAttempt"
)(function* (ctx: QueryCtx, identity: TryoutSetIdentity, userId: UserId) {
  const setIdentity = tryoutCatalogIdentity({
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    kind: "set",
    locale: identity.locale,
    setKey: identity.setKey,
    trackKey: identity.trackKey,
  });
  const progress = yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutSetProgress")
      .withIndex("by_userId_and_setIdentity", (index) =>
        index.eq("userId", userId).eq("setIdentity", setIdentity)
      )
      .unique()
  );
  if (!progress) {
    return null;
  }

  const attempt = yield* tryRuntimePromise(() =>
    ctx.db.get(progress.latestAttemptId)
  );
  if (
    !(attempt && matchesProgressAttempt(attempt, progress, identity, userId))
  ) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_PROGRESS_ATTEMPT_MISMATCH",
      message: "Try-out progress no longer identifies its latest attempt.",
    });
  }

  return attempt;
});

/** Reads one exact attempt only when it belongs to the current app user. */
export const readOwnedAttemptById = Effect.fn(
  "tryouts.runtime.readOwnedAttemptById"
)(function* (ctx: QueryCtx, attemptId: Id<"tryoutAttempts">, userId: UserId) {
  const attempt = yield* tryRuntimePromise(() => ctx.db.get(attemptId));
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

/** Checks that compact progress and its latest attempt describe one state. */
function matchesProgressAttempt(
  attempt: TryoutAttempt,
  progress: Doc<"tryoutSetProgress">,
  identity: TryoutSetIdentity,
  userId: UserId
) {
  if (!matchesAttemptIdentity(progress, identity)) {
    return false;
  }
  if (!matchesAttemptIdentity(readAttemptSetIdentity(attempt), identity)) {
    return false;
  }
  if (
    attempt.userId !== userId ||
    attempt.setIdentity !== progress.setIdentity
  ) {
    return false;
  }
  if (attempt.attemptNumber !== progress.attemptNumber) {
    return false;
  }
  if (attempt.status !== progress.status) {
    return false;
  }
  return progress.statusRank === getTryoutStatusRank(progress.status);
}

/** Reads one bounded attempt history page through immutable set keys. */
export const readAttemptHistoryPageBySet = Effect.fn(
  "tryouts.runtime.readAttemptHistoryPageBySet"
)(function* (
  ctx: QueryCtx,
  identity: TryoutSetIdentity,
  userId: UserId,
  pagination: PaginationOptions
) {
  const setIdentity = tryoutCatalogIdentity({ ...identity, kind: "set" });
  return yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_setIdentity_and_startedAt", (index) =>
        index.eq("userId", userId).eq("setIdentity", setIdentity)
      )
      .order("desc")
      .paginate(pagination)
  );
});
