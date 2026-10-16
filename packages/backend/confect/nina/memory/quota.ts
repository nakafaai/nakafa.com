import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  MEMORY_WRITES_PER_MINUTE,
  NinaMemoryRejected,
} from "@repo/backend/confect/nina/memory.spec";
import { Effect } from "effect";

/**
 * One bucket for the writes a learner makes by hand. It refills evenly over the
 * minute, and holds a whole minute's worth, so a burst of writes passes and a
 * script that writes without end does not.
 */
const writeQuota = new RateLimiter(components.agentRateLimiter, {
  ninaMemoryWrite: {
    capacity: MEMORY_WRITES_PER_MINUTE,
    kind: "token bucket",
    period: MINUTE,
    rate: MEMORY_WRITES_PER_MINUTE,
  },
});

/**
 * Takes one write from the learner's bucket, or refuses it with the reason
 * `limit`. The bucket lives in the transaction of the write, so a write that
 * fails keeps its place. A component failure is a deployment defect, so it dies
 * instead of reaching the caller.
 */
export const limitWrites = Effect.fn("nina.memory.limit")(function* (
  userId: Docs["users"]["_id"]
) {
  const ctx = yield* MutationCtx;
  const quota = yield* Effect.tryPromise(() =>
    writeQuota.limit(ctx, "ninaMemoryWrite", { key: userId })
  ).pipe(Effect.orDie);
  if (!quota.ok) {
    return yield* new NinaMemoryRejected({ reason: "limit" });
  }
});
