import { Ref } from "@confect/core";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { afterEach, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";

afterEach(() => vi.restoreAllMocks());

it("reports a component outage as unavailable instead of approving an unmetered read", async () => {
  vi.spyOn(RateLimiter.prototype, "limit").mockRejectedValueOnce(
    new Error("quota unavailable")
  );
  await expect(
    createConvexTestWithBetterAuth().mutation(
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
