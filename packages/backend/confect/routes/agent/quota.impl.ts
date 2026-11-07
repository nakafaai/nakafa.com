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
