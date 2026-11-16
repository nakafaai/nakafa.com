import { FunctionImpl, GroupImpl } from "@confect/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  AgentRateLimitError,
  PUBLIC_READ_QUOTA,
} from "@repo/backend/confect/routes/agent/quota";
import spec from "@repo/backend/confect/routes/agent/quota.spec";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Effect, Layer } from "effect";

/**
 * One bucket per client address, in `QUOTA_SHARDS` shards. An unsharded bucket
 * is one row, so a client's reads in the same instant retried against each
 * other: Convex Insights showed every OCC retry of `consume` on one such row,
 * one scanner bursting its own quota. Each read now takes a token from one
 * shard, so two reads retry only when they meet on the same shard, and nothing
 * reads the other shards: the answer carries the quota's policy, never a count
 * of what is left (`AGENT_QUOTA_HEADERS`). Two clients never share a row.
 */
/**
 * The shards of a client's bucket. Each holds a sixth of the 30 reads, five,
 * and refills 20 a minute, and a read takes from one shard at random.
 */
const QUOTA_SHARDS = 6;

const limiter = new RateLimiter(components.agentRateLimiter, {
  publicRead: {
    capacity: PUBLIC_READ_QUOTA.capacity,
    kind: "token bucket",
    period: MINUTE,
    rate: PUBLIC_READ_QUOTA.ratePerMinute,
    shards: QUOTA_SHARDS,
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
    return null;
  })
);
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(consume),
  GroupImpl.finalize
);
