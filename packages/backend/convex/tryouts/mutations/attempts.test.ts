import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { products } from "@repo/backend/convex/utils/polar/products";
import { describe, expect, it } from "vitest";

describe("tryouts/mutations/attempts", () => {
  it("starts new tryout attempts without persisting a legacy irtScore field", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-reporting",
      });
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-start");

      await ctx.db.insert("customers", {
        id: "customer-start-reporting",
        externalId: null,
        metadata: {},
        userId: identity.userId,
      });
      await ctx.db.insert("subscriptions", {
        id: "subscription-start-reporting",
        customerId: "customer-start-reporting",
        createdAt: new Date(NOW).toISOString(),
        modifiedAt: null,
        amount: null,
        currency: null,
        recurringInterval: null,
        status: "active",
        currentPeriodStart: new Date(NOW).toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        startedAt: new Date(NOW).toISOString(),
        endedAt: null,
        productId: products.pro.id,
        checkoutId: null,
        metadata: {},
      });

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "2026-reporting-start",
      });

    const tryoutAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", identity.userId).eq("tryoutId", identity.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(tryoutAttempt).not.toBeNull();
    expect(tryoutAttempt?.theta).toBe(0);

    if (!tryoutAttempt) {
      return;
    }

    expect("irtScore" in tryoutAttempt).toBe(false);
    expect(tryoutAttempt.partSetSnapshots).toEqual([
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 20,
        setId: expect.any(String),
      },
    ]);
  });
});
