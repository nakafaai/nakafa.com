import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  insertPolarAccount,
  insertProSubscription,
} from "@repo/backend/test/billing";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

describe("billing/queries", () => {
  it("answers whether the viewer holds an active subscription on a personal account", async () => {
    const t = createConvexTestWithBetterAuth();
    const user = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "has-subscription" })
    );
    const authed = t.withIdentity({
      sessionId: user.sessionId,
      subject: user.authUserId,
    });
    expect(
      await authed.query(api.billing.queries.hasActiveSubscription, {})
    ).toBe(false);
    await t.mutation(async (ctx) => {
      const accountId = await insertPolarAccount(
        ctx,
        user.userId,
        "cust_query"
      );
      await insertProSubscription(ctx, accountId, { status: "pastDue" });
    });
    expect(
      await authed.query(api.billing.queries.hasActiveSubscription, {})
    ).toBe(false);
    await t.mutation(async (ctx) => {
      const accountId = await ctx.db
        .query("billingAccounts")
        .first()
        .then((account) => account?._id);
      if (!accountId) {
        throw new Error("Expected the seeded account.");
      }
      await insertProSubscription(ctx, accountId, {
        subscriptionId: "sub_active",
      });
    });
    expect(
      await authed.query(api.billing.queries.hasActiveSubscription, {})
    ).toBe(true);
  });

  it("refuses the subscription answer to an unauthenticated viewer", async () => {
    const t = createConvexTestWithBetterAuth();
    await expect(
      t.query(api.billing.queries.hasActiveSubscription, {})
    ).rejects.toThrow();
  });
});
