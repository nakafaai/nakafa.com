import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

/**
 * The tries that the sittings take (ADR 0013). A device may try five times a minute. One
 * person may fail five times a minute in one sitting, so no number of devices can guess a
 * token quickly, and one student's failures never lock out the other students of the sitting.
 * An account that joins a school by a room's code may fail five times a minute in that school,
 * however many rooms it tries. A token bucket refills its tries evenly, so each limit is the
 * number of tries a minute.
 */
const limits = new RateLimiter(components.agentRateLimiter, {
  roomFailedJoinsByAccount: {
    capacity: 5,
    kind: "token bucket",
    period: MINUTE,
    rate: 5,
  },
  sittingFailedTriesByPerson: {
    capacity: 5,
    kind: "token bucket",
    period: MINUTE,
    rate: 5,
  },
  sittingTryByDevice: {
    capacity: 5,
    kind: "token bucket",
    period: MINUTE,
    rate: 5,
  },
});

/** Counts one try from one device against its limit, and says whether the try may go on. */
export const deviceMayTry = Effect.fn("exams.sittings.rate.device")(function* (
  deviceId: string
) {
  const ctx = yield* MutationCtx;
  const quota = yield* Effect.tryPromise(() =>
    limits.limit(ctx, "sittingTryByDevice", { key: deviceId })
  ).pipe(Effect.orDie);
  return quota.ok;
});

/** The key of one person's failed tries in one sitting. */
const personKey = (sittingId: string, personId: string) =>
  `${sittingId}:${personId}`;

/**
 * Whether one person may fail again in one sitting. It reads the limit without using a
 * try, so a person who has run out is refused even with the right token.
 */
export const personMayFail = Effect.fn("exams.sittings.rate.person")(function* (
  sittingId: string,
  personId: string
) {
  const ctx = yield* MutationCtx;
  const quota = yield* Effect.tryPromise(() =>
    limits.check(ctx, "sittingFailedTriesByPerson", {
      key: personKey(sittingId, personId),
    })
  ).pipe(Effect.orDie);
  return quota.ok;
});

/** Counts one failed try of one person in one sitting against that person's limit. */
export const countFailedTry = Effect.fn("exams.sittings.rate.failed")(
  function* (sittingId: string, personId: string) {
    const ctx = yield* MutationCtx;
    yield* Effect.tryPromise(() =>
      limits.limit(ctx, "sittingFailedTriesByPerson", {
        key: personKey(sittingId, personId),
      })
    ).pipe(Effect.orDie);
  }
);

/** The key of one account's failed joins in one school. */
const accountKey = (tenantId: string, userId: string) =>
  `${tenantId}:${userId}`;

/**
 * Whether one account may fail again to join one school by a room's code. It reads the limit
 * without using a try, so an account that has run out is refused even with the right code.
 */
export const accountMayFail = Effect.fn("exams.sittings.rate.account")(
  function* (tenantId: string, userId: string) {
    const ctx = yield* MutationCtx;
    const quota = yield* Effect.tryPromise(() =>
      limits.check(ctx, "roomFailedJoinsByAccount", {
        key: accountKey(tenantId, userId),
      })
    ).pipe(Effect.orDie);
    return quota.ok;
  }
);

/** Counts one failed join of one account in one school against that account's limit. */
export const countFailedJoin = Effect.fn("exams.sittings.rate.failedJoin")(
  function* (tenantId: string, userId: string) {
    const ctx = yield* MutationCtx;
    yield* Effect.tryPromise(() =>
      limits.limit(ctx, "roomFailedJoinsByAccount", {
        key: accountKey(tenantId, userId),
      })
    ).pipe(Effect.orDie);
  }
);
