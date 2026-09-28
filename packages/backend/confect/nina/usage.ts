import type { UsageHandler } from "@convex-dev/agent";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { NinaUsage } from "@repo/backend/confect/nina/usage.spec";
import { Effect, Schema } from "effect";

/** Bind the Agent SDK callback to the durable usage ledger for this turn. */
export const createUsageHandler = Effect.fn("nina.usage.handler")(function* (
  turnId: NinaTurnsDoc["_id"]
) {
  const mutate = yield* MutationRunner;
  const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
  const handler: UsageHandler = (_ctx, event) =>
    runPromise(
      Schema.decodeUnknownEffect(NinaUsage)({
        agent: event.agentName,
        model: event.model,
        provider: event.provider,
        input: event.usage.inputTokens ?? 0,
        output: event.usage.outputTokens ?? 0,
      }).pipe(
        Effect.flatMap((usage) =>
          mutate(refs.internal.nina.usage.record, { turnId, usage })
        ),
        Effect.asVoid
      )
    );
  return handler;
});
