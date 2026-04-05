import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getStoredCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { syncCustomerPlan } from "@repo/backend/convex/triggers/helpers/subscriptions";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 18, 0, 0);

/** Inserts one minimal app user row for subscription-trigger tests. */
async function insertUser(
  ctx: MutationCtx,
  suffix: string,
  overrides?: Partial<{
    credits: number;
    creditsResetAt: number;
    plan: "free" | "pro";
  }>
) {
  return await ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    email: `${suffix}@example.com`,
    name: `User ${suffix}`,
    plan: overrides?.plan ?? "free",
    credits: overrides?.credits ?? 10,
    creditsResetAt: overrides?.creditsResetAt ?? NOW,
  });
}

/** Inserts one local customer row that links Polar data to an app user. */
async function insertCustomer(
  ctx: MutationCtx,
  userId: Id<"users">,
  customerId: string
) {
  return await ctx.db.insert("customers", {
    id: customerId,
    externalId: null,
    metadata: {},
    userId,
  });
}

/** Inserts one subscription row with a stable timestamp window. */
async function insertSubscription(
  ctx: MutationCtx,
  {
    customerId,
    productId,
    status,
    subscriptionId,
  }: {
    customerId: string;
    productId: string;
    status: string;
    subscriptionId: string;
  }
) {
  const timestamp = new Date(NOW).toISOString();

  return await ctx.db.insert("subscriptions", {
    id: subscriptionId,
    customerId,
    createdAt: timestamp,
    modifiedAt: null,
    amount: null,
    currency: null,
    recurringInterval: null,
    status,
    currentPeriodStart: timestamp,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    startedAt: timestamp,
    endedAt: null,
    productId,
    checkoutId: null,
    metadata: {},
  });
}

/** Loads one subscription by Polar ID and runs the trigger helper against it. */
async function runSyncCustomerPlanBySubscriptionId(
  ctx: MutationCtx,
  subscriptionId: string
) {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_subscriptionId", (q) => q.eq("id", subscriptionId))
    .unique();

  if (!subscription) {
    return false;
  }

  await syncCustomerPlan(ctx, subscription);
  return true;
}

describe("triggers/helpers/subscriptions", () => {
  beforeEach(() => {
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns without side effects when the customer is missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      await insertSubscription(ctx, {
        customerId: "missing-customer",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-missing-customer",
      });

      const ran = await runSyncCustomerPlanBySubscriptionId(
        ctx,
        "sub-missing-customer"
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

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

      const ran = await runSyncCustomerPlanBySubscriptionId(
        ctx,
        "sub-missing-user"
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

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

      await runSyncCustomerPlanBySubscriptionId(ctx, "sub-no-op");

      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        storedResetAt: await getStoredCreditResetTimestamp(ctx.db, "free"),
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

  it("upgrades a free user to pro and records a purchase transaction", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "upgrade", {
        credits: 4,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        plan: "free",
      });

      await insertCustomer(ctx, userId, "polar-upgrade");
      await insertSubscription(ctx, {
        customerId: "polar-upgrade",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-upgrade",
      });

      await runSyncCustomerPlanBySubscriptionId(ctx, "sub-upgrade");

      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        storedResetAt: await getStoredCreditResetTimestamp(ctx.db, "pro"),
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
    expect(result.storedResetAt).toBe(Date.UTC(2026, 3, 1, 0, 0, 0));
  });

  it("downgrades a pro user to free and records the reset grant transaction", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "downgrade", {
        credits: 120,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        plan: "pro",
      });

      await insertCustomer(ctx, userId, "polar-downgrade");
      await insertSubscription(ctx, {
        customerId: "polar-downgrade",
        productId: "free-plan",
        status: "active",
        subscriptionId: "sub-downgrade",
      });

      await runSyncCustomerPlanBySubscriptionId(ctx, "sub-downgrade");

      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        storedResetAt: await getStoredCreditResetTimestamp(ctx.db, "free"),
        user: await ctx.db.get("users", userId),
      };
    });

    expect(result.user).toMatchObject({
      credits: 10,
      plan: "free",
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
    expect(result.creditTransactions).toEqual([
      expect.objectContaining({
        amount: 10,
        balanceAfter: 10,
        type: "daily-grant",
        metadata: expect.objectContaining({
          reason: "plan-downgrade",
          "new-plan": "free",
          "previous-plan": "pro",
          "subscription-id": "sub-downgrade",
        }),
      }),
    ]);
    expect(result.storedResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
  });

  it("picks the highest plan across overlapping active subscriptions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "highest-plan", {
        credits: 10,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        plan: "free",
      });

      await insertCustomer(ctx, userId, "polar-highest-plan");
      await insertSubscription(ctx, {
        customerId: "polar-highest-plan",
        productId: "free-plan",
        status: "active",
        subscriptionId: "sub-highest-plan-free",
      });
      await insertSubscription(ctx, {
        customerId: "polar-highest-plan",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-highest-plan-pro",
      });
      await insertSubscription(ctx, {
        customerId: "polar-highest-plan",
        productId: products.pro.id,
        status: "canceled",
        subscriptionId: "sub-highest-plan-canceled",
      });

      await runSyncCustomerPlanBySubscriptionId(ctx, "sub-highest-plan-free");

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
    });
  });

  it("reads every active subscription and removes stale duplicate entitlements", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const userId = await insertUser(ctx, "many-active-subscriptions", {
        credits: 10,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        plan: "free",
      });

      await insertCustomer(ctx, userId, "polar-many-active-subscriptions");

      for (let index = 0; index < 11; index += 1) {
        await insertSubscription(ctx, {
          customerId: "polar-many-active-subscriptions",
          productId: "free-plan",
          status: "active",
          subscriptionId: `sub-many-active-free-${index}`,
        });
      }

      const proSubscriptionId = await insertSubscription(ctx, {
        customerId: "polar-many-active-subscriptions",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-many-active-pro",
      });

      await ctx.db.insert("userTryoutEntitlements", {
        userId,
        product: "snbt",
        sourceKind: "subscription",
        startsAt: NOW - 2000,
        endsAt: NOW - 1000,
      });
      await ctx.db.insert("userTryoutEntitlements", {
        userId,
        product: "snbt",
        sourceKind: "subscription",
        subscriptionId: proSubscriptionId,
        startsAt: NOW - 2000,
        endsAt: NOW - 1000,
      });
      await ctx.db.insert("userTryoutEntitlements", {
        userId,
        product: "snbt",
        sourceKind: "subscription",
        subscriptionId: proSubscriptionId,
        startsAt: NOW - 3000,
        endsAt: NOW - 1000,
      });

      await runSyncCustomerPlanBySubscriptionId(ctx, "sub-many-active-free-0");

      return {
        entitlements: await ctx.db
          .query("userTryoutEntitlements")
          .withIndex("by_userId_and_sourceKind_and_subscriptionId", (q) =>
            q.eq("userId", userId).eq("sourceKind", "subscription")
          )
          .collect(),
        proSubscriptionId,
        user: await ctx.db.get("users", userId),
      };
    });

    expect(result.user).toMatchObject({
      credits: 3000,
      plan: "pro",
      creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
    });
    expect(result.entitlements).toEqual([
      expect.objectContaining({
        product: "snbt",
        sourceKind: "subscription",
        subscriptionId: result.proSubscriptionId,
      }),
    ]);
  });
});
