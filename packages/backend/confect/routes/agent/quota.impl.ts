import { FunctionImpl, GroupImpl } from "@confect/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  AgentRateLimitError,
  PUBLIC_READ_QUOTA,
  readAgentQuota,
} from "@repo/backend/confect/routes/agent/quota";
import spec from "@repo/backend/confect/routes/agent/quota.spec";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Effect, Layer } from "effect";

/**
 * One bucket per client address, unsharded, on purpose. A bucket is one row, so
 * reads from one client in the same instant retry against each other: Convex
 * Insights on 7 Nov 2026 showed all 29 OCC retries of `consume` in 72 hours on a
 * single row, at the minutes of three is-agentic scans (10:21, 14:26 and 17:13
 * UTC), which is one scanner bursting its own quota. Every retry succeeded.
 * Sharding the bucket would only add reads: the remaining count that the
 * RateLimit fields carry is read with `getValue`, which samples a shard other
 * than the one `limit` wrote, and then conflicts with that shard's writers. Two
 * different clients never share a row, so this contention cannot spread.
 */
const limiter = new RateLimiter(components.agentRateLimiter, {
  publicRead: {
    capacity: PUBLIC_READ_QUOTA.capacity,
    kind: "token bucket",
    period: MINUTE,
    rate: PUBLIC_READ_QUOTA.ratePerMinute,
  },
});

/** A failure of the component, which never admits a read it could not meter. */
function quotaUnavailable(cause: unknown) {
  return new NakafaAgentDataReadError({
    cause: getUnknownErrorMessage(cause),
    message: "The public API quota boundary is unavailable.",
  });
}
const consume = FunctionImpl.make(
  schema,
  spec,
  "consume",
  Effect.fn("agent.consumeQuota")(function* ({ key }) {
    // The component SDK owns its state and requires Convex's mutation context.
    const ctx = yield* MutationCtx;
    const status = yield* Effect.tryPromise({
      try: () => limiter.limit(ctx, "publicRead", { key }),
      catch: quotaUnavailable,
    });
    if (!status.ok) {
      return yield* new AgentRateLimitError({
        retryAfterMs: Math.max(0, status.retryAfter),
      });
    }
    // The bucket after this read, so the answer can tell the client what is left.
    const bucket = yield* Effect.tryPromise({
      try: () => limiter.getValue(ctx, "publicRead", { key }),
      catch: quotaUnavailable,
    });
    return readAgentQuota(bucket.value);
  })
);
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(consume),
  GroupImpl.finalize
);
