import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { afterEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { DEFAULT_USER_CREDITS } from "@repo/backend/confect/credits/constants";
import { getStoredCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { products } from "@repo/backend/confect/customers/polar/products";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { syncCustomerPlan } from "@repo/backend/confect/triggers/subscriptions/impl";
import { createWebhookTestConvex } from "@repo/backend/test/polar";
import {
  insertCustomer,
  insertSubscription,
  insertUser,
  NOW,
  runSyncCustomerPlanBySubscriptionId,
} from "@repo/backend/test/subscriptions";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

describe("triggers/subscriptions/impl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("fails the plan sync transaction when its customer lookup fails", async () => {
    const t = createWebhookTestConvex();
    await expect(
      t.mutation(async (ctx) => {
        const id = await insertSubscription(ctx, {
          customerId: "broken",
          productId: products.pro.id,
          status: "active",
          subscriptionId: "broken",
        });
        const subscription = await ctx.db.get("subscriptions", id);
        if (!subscription) {
          throw new Error("Fixture subscription missing");
        }
        vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
          throw new Error("lookup unavailable");
        });
        return Effect.runPromise(
          syncCustomerPlan(subscription).pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        );
      })
    ).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_SYNC_IO_FAILED",
      message: "lookup unavailable",
    });
  });
  it("returns without side effects when the customer is missing", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      await insertSubscription(ctx, {
        customerId: "missing-customer",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-missing-customer",
      });
      const ran = await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-missing-customer")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        ran,
      };
    });
    expect(result.ran).toBe(true);
    expect(result.creditTransactions).toHaveLength(0);
  });
  it("returns without side effects when the customer user is missing", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "missing-user");
      await insertCustomer(ctx, userId, "polar-missing-user");
      await ctx.db.delete("users", userId);
      await insertSubscription(ctx, {
        customerId: "polar-missing-user",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-missing-user",
      });
      const ran = await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-missing-user")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        ran,
      };
    });
    expect(result.ran).toBe(true);
    expect(result.creditTransactions).toHaveLength(0);
  });
  it("returns early when the derived plan is unchanged", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "no-op", {
        credits: 7,
        creditsResetAt: NOW - 1000,
        plan: "free",
      });
      await insertCustomer(ctx, userId, "polar-no-op");
      await insertSubscription(ctx, {
        customerId: "polar-no-op",
        productId: "free-plan",
        status: "active",
        subscriptionId: "sub-no-op",
      });
      await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-no-op")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        storedResetAt: await Effect.runPromise(
          getStoredCreditResetTimestamp("free").pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        ),
        user: await ctx.db.get("users", userId),
      };
    });
    expect(result.creditTransactions).toHaveLength(0);
    expect(result.storedResetAt).toBeNull();
    expect(result.user).toMatchObject({
      credits: 7,
      plan: "free",
      creditsResetAt: NOW - 1000,
    });
  });
  it("leaves the plan of an account whose deletion has begun as it is", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "deleting", { plan: "free" });
      await ctx.db.patch("users", userId, { deletionPreparedAt: NOW });
      await insertCustomer(ctx, userId, "polar-deleting");
      await insertSubscription(ctx, {
        customerId: "polar-deleting",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-deleting",
      });
      await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-deleting")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        user: await ctx.db.get("users", userId),
      };
    });
    expect(result.creditTransactions).toHaveLength(0);
    expect(result.user).toMatchObject({ plan: "free" });
  });
  it("upgrades a free user to pro and records a purchase transaction", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "upgrade", {
        credits: 4,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        plan: "free",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId,
      });
      await insertCustomer(ctx, userId, "polar-upgrade");
      await insertSubscription(ctx, {
        customerId: "polar-upgrade",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-upgrade",
      });
      await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-upgrade")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        scheduledJobs: await ctx.db.system
          .query("_scheduled_functions")
          .collect(),
        storedResetAt: await Effect.runPromise(
          getStoredCreditResetTimestamp("pro").pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        ),
        user: await ctx.db.get("users", userId),
      };
    });
    expect(result.user).toMatchObject({
      credits: 3000,
      plan: "pro",
      creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
    });
    expect(result.creditTransactions).toEqual([
      expect.objectContaining({
        amount: 3000,
        balanceAfter: 3000,
        type: "purchase",
        metadata: expect.objectContaining({
          reason: "plan-upgrade",
          "new-plan": "pro",
          "previous-plan": "free",
          "subscription-id": "sub-upgrade",
        }),
      }),
    ]);
    expect(result.scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            distinctId: result.user?._id,
            event: "subscription started",
            properties: encodeJsonText({
              product_id: products.pro.id,
              status: "active",
            }),
          }),
        ],
      }),
      expect.objectContaining({
        args: [
          expect.objectContaining({
            distinctId: result.user?._id,
            event: "plan changed",
            properties: encodeJsonText({
              new_plan: "pro",
              previous_plan: "free",
            }),
          }),
        ],
      }),
    ]);
    expect(result.storedResetAt).toBe(Date.UTC(2026, 3, 1, 0, 0, 0));
  });
  it("downgrades a pro user without recording a cancellation for an active subscription", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "downgrade", {
        credits: 120,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        plan: "pro",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId,
      });
      await insertCustomer(ctx, userId, "polar-downgrade");
      await insertSubscription(ctx, {
        customerId: "polar-downgrade",
        productId: "free-plan",
        status: "active",
        subscriptionId: "sub-downgrade",
      });
      await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-downgrade")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        scheduledJobs: await ctx.db.system
          .query("_scheduled_functions")
          .collect(),
        storedResetAt: await Effect.runPromise(
          getStoredCreditResetTimestamp("free").pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        ),
        user: await ctx.db.get("users", userId),
      };
    });
    expect(result.user).toMatchObject({
      credits: DEFAULT_USER_CREDITS,
      plan: "free",
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
    expect(result.creditTransactions).toEqual([
      expect.objectContaining({
        amount: DEFAULT_USER_CREDITS,
        balanceAfter: DEFAULT_USER_CREDITS,
        type: "daily-grant",
        metadata: expect.objectContaining({
          reason: "plan-downgrade",
          "new-plan": "free",
          "previous-plan": "pro",
          "subscription-id": "sub-downgrade",
        }),
      }),
    ]);
    expect(result.scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            distinctId: result.user?._id,
            event: "plan changed",
            properties: encodeJsonText({
              new_plan: "free",
              previous_plan: "pro",
            }),
          }),
        ],
      }),
    ]);
    expect(result.storedResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
  });
  it("records a cancellation only when a canceled subscription downgrades the user", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "canceled-downgrade", {
        credits: 120,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        plan: "pro",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId,
      });
      await insertCustomer(ctx, userId, "polar-canceled-downgrade");
      await insertSubscription(ctx, {
        customerId: "polar-canceled-downgrade",
        productId: products.pro.id,
        status: "canceled",
        subscriptionId: "sub-canceled-downgrade",
      });
      await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-canceled-downgrade")
      );
      return {
        scheduledJobs: await ctx.db.system
          .query("_scheduled_functions")
          .collect(),
        user: await ctx.db.get("users", userId),
      };
    });
    expect(result.user).toMatchObject({
      credits: DEFAULT_USER_CREDITS,
      plan: "free",
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
    expect(result.scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            distinctId: result.user?._id,
            event: "subscription canceled",
            properties: encodeJsonText({
              product_id: products.pro.id,
              status: "canceled",
            }),
          }),
        ],
      }),
      expect.objectContaining({
        args: [
          expect.objectContaining({
            distinctId: result.user?._id,
            event: "plan changed",
            properties: encodeJsonText({
              new_plan: "free",
              previous_plan: "pro",
            }),
          }),
        ],
      }),
    ]);
  });
  it("finds Pro beyond unrelated active subscriptions and attributes the earliest matching grant", async () => {
    vi.setSystemTime(NOW);
    const t = createWebhookTestConvex();
    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "highest-plan", {
        credits: 10,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        plan: "free",
      });
      await insertCustomer(ctx, userId, "polar-highest-plan");
      for (let index = 0; index < 20; index += 1) {
        await insertSubscription(ctx, {
          customerId: "polar-highest-plan",
          productId: `unrelated-product-${index}`,
          status: "active",
          subscriptionId: `sub-unrelated-${index}`,
        });
      }
      await insertSubscription(ctx, {
        customerId: "polar-highest-plan",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-highest-plan-pro",
      });
      await insertSubscription(ctx, {
        customerId: "polar-highest-plan",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-later-pro",
      });
      await insertSubscription(ctx, {
        customerId: "polar-highest-plan",
        productId: products.pro.id,
        status: "canceled",
        subscriptionId: "sub-highest-plan-canceled",
      });
      await Effect.runPromise(
        runSyncCustomerPlanBySubscriptionId(ctx, "sub-unrelated-0")
      );
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        user: await ctx.db.get("users", userId),
      };
    });
    expect(result.user).toMatchObject({
      credits: 3000,
      plan: "pro",
      creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
    });
    expect(result.creditTransactions).toHaveLength(1);
    expect(result.creditTransactions[0]).toMatchObject({
      amount: 3000,
      type: "purchase",
      metadata: expect.objectContaining({
        "subscription-id": "sub-highest-plan-pro",
      }),
    });
  });
});
