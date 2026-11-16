import { Ref } from "@confect/core";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { afterEach, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";
import { Array as Arr, Effect, Option, Schema } from "effect";

afterEach(() => vi.restoreAllMocks());

it("reports a component outage as unavailable instead of approving an unmetered read", async () => {
  vi.spyOn(RateLimiter.prototype, "limit").mockRejectedValueOnce(
    new Error("quota unavailable")
  );
  await expect(
    createConvexTestWithAuth().mutation(
      Ref.getFunctionReference(refs.internal.routes.agent.quota.consume),
      { key: "a".repeat(64) }
    )
  ).rejects.toMatchObject({
    data: {
      _tag: "NakafaAgentDataReadError",
      message: "The public API quota boundary is unavailable.",
    },
  });
});

/** How a refused read ends: the quota's typed failure, with how long to wait. */
const Refusal = Schema.TaggedStruct("AgentRateLimitError", {
  retryAfterMs: Schema.Finite,
});

it.effect(
  "admits a client's reads from its sharded bucket, and refuses an empty one with how long to wait",
  () =>
    Effect.gen(function* () {
      // Every read takes from shard 0 or 1 of the bucket's six, whose ten tokens
      // are then the bucket, since `Math.random` answers 0.
      vi.spyOn(Math, "random").mockReturnValue(0);
      const t = createConvexTestWithAuth();
      const consume = Ref.getFunctionReference(
        refs.internal.routes.agent.quota.consume
      );
      const outcomes = yield* Effect.forEach(Arr.range(1, 12), () =>
        Effect.promise(() =>
          t.mutation(consume, { key: "b".repeat(64) }).then(
            () => Option.none(),
            (error: { readonly data?: unknown }) =>
              Option.some(Schema.decodeUnknownSync(Refusal)(error.data))
          )
        )
      );
      const [admitted, refused] = Arr.splitAt(outcomes, 10);
      expect(Arr.every(admitted, Option.isNone)).toBe(true);
      expect(
        Arr.every(refused, (outcome) =>
          Option.exists(outcome, ({ retryAfterMs }) => retryAfterMs > 0)
        )
      ).toBe(true);
    })
);
