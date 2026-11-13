import { Ref } from "@confect/core";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { afterEach, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";

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

it("answers the reads left after each admitted read", async () => {
  const t = createConvexTestWithAuth();
  const consume = Ref.getFunctionReference(
    refs.internal.routes.agent.quota.consume
  );
  const first = await t.mutation(consume, { key: "b".repeat(64) });
  const second = await t.mutation(consume, { key: "b".repeat(64) });

  expect(first.remaining).toBe(29);
  expect(second.remaining).toBe(28);
  expect(second.resetSeconds).toBeGreaterThanOrEqual(1);
  expect(second.resetSeconds).toBeLessThanOrEqual(15);
});

it("reports an unreadable bucket as unavailable instead of guessing what is left", async () => {
  vi.spyOn(RateLimiter.prototype, "getValue").mockRejectedValueOnce(
    new Error("bucket unavailable")
  );
  await expect(
    createConvexTestWithAuth().mutation(
      Ref.getFunctionReference(refs.internal.routes.agent.quota.consume),
      { key: "c".repeat(64) }
    )
  ).rejects.toMatchObject({
    data: {
      _tag: "NakafaAgentDataReadError",
      message: "The public API quota boundary is unavailable.",
    },
  });
});
