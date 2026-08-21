import { requestAnalyticsErasure } from "@repo/backend/convex/analytics/erasure/request";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("analytics erasure request", () => {
  it("admits erasure from the action boundary", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "erasure-request-user",
        credits: 0,
        creditsResetAt: 0,
        email: "erasure-request@example.com",
        name: "Erasure Request",
        plan: "free",
      })
    );
    const startErasure = vi.fn(async () => undefined);

    await t.action((ctx) =>
      runConvexProgram(requestAnalyticsErasure(ctx, userId, startErasure))
    );

    expect(startErasure).toHaveBeenCalledWith(expect.any(Object), userId);
  });

  it("surfaces a typed failure when workflow admission fails", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "failed-erasure-request-user",
        credits: 0,
        creditsResetAt: 0,
        email: "failed-erasure-request@example.com",
        name: "Failed Erasure Request",
        plan: "free",
      })
    );
    const startErasure = vi.fn(async () =>
      Promise.reject(new Error("workflow unavailable"))
    );

    await expect(
      t.action((ctx) =>
        runConvexProgram(requestAnalyticsErasure(ctx, userId, startErasure))
      )
    ).rejects.toMatchObject({
      data: {
        code: "ANALYTICS_ERASURE_REQUEST_FAILED",
        message: expect.stringContaining("workflow unavailable"),
      },
    });
  });
});
