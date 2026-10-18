import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

/**
 * The tries that one sitting's token takes. A device may try five times a minute, and a
 * sitting takes at most sixty failed tries a minute, so no number of devices can guess
 * the token quickly (ADR 0013, round 2 decision 11). A token bucket refills its tries
 * evenly, so each limit is the number of tries a minute.
 */
const limits = new RateLimiter(components.agentRateLimiter, {
  sittingFailedTries: {
    capacity: 60,
    kind: "token bucket",
    period: MINUTE,
    rate: 60,
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

/**
 * Whether a sitting may take another failed try. It reads the limit without using a
 * try, so a sitting that has run out refuses even the right token.
 */
export const sittingMayFail = Effect.fn("exams.sittings.rate.sitting")(
  function* (sittingId: string) {
    const ctx = yield* MutationCtx;
    const quota = yield* Effect.tryPromise(() =>
      limits.check(ctx, "sittingFailedTries", { key: sittingId })
    ).pipe(Effect.orDie);
    return quota.ok;
  }
);

/** Counts one failed try of a sitting's token against the sitting's limit. */
export const countFailedTry = Effect.fn("exams.sittings.rate.failed")(
  function* (sittingId: string) {
    const ctx = yield* MutationCtx;
    yield* Effect.tryPromise(() =>
      limits.limit(ctx, "sittingFailedTries", { key: sittingId })
    ).pipe(Effect.orDie);
  }
);
