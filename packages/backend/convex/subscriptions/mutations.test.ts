import posthogTest from "@posthog/convex/test";
import { internal } from "@repo/backend/convex/_generated/api";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { convexModules } from "@repo/backend/convex/test.setup";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 18, 0, 0);

type SubscriptionInput = Pick<
  SubscriptionRecord,
  "customerId" | "productId" | "status"
> & {
  subscriptionId: SubscriptionRecord["id"];
};

/** Builds one subscription payload with stable webhook timestamps. */
function buildSubscription({
  customerId,
  productId,
  status,
  subscriptionId,
}: SubscriptionInput): SubscriptionRecord {
  const timestamp = new Date(NOW).toISOString();

  return {
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
  };
}

/** Loads one stored subscription by Polar subscription ID. */
async function loadSubscription(
  ctx: QueryCtx,
  subscriptionId: SubscriptionRecord["id"]
) {
  return await ctx.db
    .query("subscriptions")
    .withIndex("by_subscriptionId", (q) => q.eq("id", subscriptionId))
    .unique();
}

/** Builds a trigger-aware subscription test deployment. */
function createSubscriptionTestConvex() {
  const t = convexTest(schema, convexModules);
  posthogTest.register(t);
  return t;
}

/** Inserts one local user and linked Polar customer. */
async function insertBillingUser(
  ctx: MutationCtx,
  {
    credits,
    customerId,
    plan,
    suffix,
  }: {
    credits: number;
    customerId: string;
    plan: "free" | "pro";
    suffix: string;
  }
) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits,
    creditsResetAt: NOW,
    email: `${suffix}@example.com`,
    name: `User ${suffix}`,
    plan,
  });
  await ctx.db.insert("customers", {
    externalId: null,
    id: customerId,
    metadata: {},
    userId,
  });

  return userId;
}

describe("subscriptions/mutations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates subscriptions idempotently from webhook payloads", async () => {
    const t = convexTest(schema, convexModules);
    const subscription = buildSubscription({
      customerId: "polar-create",
      productId: products.pro.id,
      status: "active",
      subscriptionId: "sub-create",
    });

    const firstId = await t.mutation(
      internal.subscriptions.mutations.createSubscription,
      { subscription }
    );
    const secondId = await t.mutation(
      internal.subscriptions.mutations.createSubscription,
      { subscription }
    );

    const rows = await t.query(
      async (ctx) => await ctx.db.query("subscriptions").collect()
    );

    expect(secondId).toBe(firstId);
    expect(rows).toEqual([
      expect.objectContaining({
        _id: firstId,
        id: "sub-create",
        status: "active",
      }),
    ]);
  });

  it("creates missing subscriptions when update webhooks arrive first", async () => {
    const t = convexTest(schema, convexModules);
    const subscription = buildSubscription({
      customerId: "polar-out-of-order",
      productId: products.pro.id,
      status: "active",
      subscriptionId: "sub-out-of-order",
    });

    const result = await t.mutation(
      internal.subscriptions.mutations.updateSubscription,
      { subscription }
    );
    const storedSubscription = await t.query(
      async (ctx) => await loadSubscription(ctx, "sub-out-of-order")
    );

    expect(result).toBeNull();
    expect(storedSubscription).toMatchObject({
      customerId: "polar-out-of-order",
      id: "sub-out-of-order",
      status: "active",
    });
  });

  it("patches existing subscriptions from update webhooks", async () => {
    const t = convexTest(schema, convexModules);
    const subscription = buildSubscription({
      customerId: "polar-update",
      productId: products.pro.id,
      status: "active",
      subscriptionId: "sub-update",
    });

    await t.mutation(internal.subscriptions.mutations.createSubscription, {
      subscription,
    });

    const result = await t.mutation(
      internal.subscriptions.mutations.updateSubscription,
      {
        subscription: {
          ...subscription,
          status: "canceled",
        },
      }
    );
    const rows = await t.query(
      async (ctx) => await ctx.db.query("subscriptions").collect()
    );

    expect(result).toBeNull();
    expect(rows).toEqual([
      expect.objectContaining({
        id: "sub-update",
        status: "canceled",
      }),
    ]);
  });

  it("rejects late subscription webhooks for a deleted customer", async () => {
    const t = convexTest(schema, convexModules);
    const subscription = buildSubscription({
      customerId: "polar-deleted",
      productId: products.pro.id,
      status: "active",
      subscriptionId: "sub-deleted",
    });

    await t.mutation(internal.customers.mutations.internal.deleteCustomerById, {
      id: subscription.customerId,
    });

    const createdId = await t.mutation(
      internal.subscriptions.mutations.createSubscription,
      { subscription }
    );

    await t.mutation(async (ctx) => {
      await ctx.db.insert("subscriptions", subscription);
    });
    await t.mutation(internal.subscriptions.mutations.updateSubscription, {
      subscription: {
        ...subscription,
        status: "canceled",
      },
    });

    const rows = await t.query(
      async (ctx) => await ctx.db.query("subscriptions").collect()
    );

    expect(createdId).toBeNull();
    expect(rows).toEqual([]);
  });

  it("upgrades the linked user when an active subscription is created", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createSubscriptionTestConvex();
    const userId = await t.mutation((ctx) =>
      insertBillingUser(ctx, {
        credits: 4,
        customerId: "polar-trigger-create",
        plan: "free",
        suffix: "trigger-create",
      })
    );

    await t.mutation(internal.subscriptions.mutations.createSubscription, {
      subscription: buildSubscription({
        customerId: "polar-trigger-create",
        productId: products.pro.id,
        status: "active",
        subscriptionId: "sub-trigger-create",
      }),
    });

    const state = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.user).toMatchObject({
      credits: 3000,
      plan: "pro",
    });
    expect(state.creditTransactions).toEqual([
      expect.objectContaining({
        amount: 3000,
        metadata: expect.objectContaining({
          "subscription-id": "sub-trigger-create",
        }),
        type: "purchase",
      }),
    ]);
  });

  it("downgrades the linked user when its subscription is canceled", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createSubscriptionTestConvex();
    const userId = await t.mutation((ctx) =>
      insertBillingUser(ctx, {
        credits: 4,
        customerId: "polar-trigger-update",
        plan: "free",
        suffix: "trigger-update",
      })
    );
    const activeSubscription = buildSubscription({
      customerId: "polar-trigger-update",
      productId: products.pro.id,
      status: "active",
      subscriptionId: "sub-trigger-update",
    });

    await t.mutation(internal.subscriptions.mutations.createSubscription, {
      subscription: activeSubscription,
    });
    await t.mutation(internal.subscriptions.mutations.updateSubscription, {
      subscription: {
        ...activeSubscription,
        status: "canceled",
      },
    });

    const state = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.user).toMatchObject({
      credits: 10,
      plan: "free",
    });
    expect(state.creditTransactions).toEqual([
      expect.objectContaining({
        amount: 3000,
        type: "purchase",
      }),
      expect.objectContaining({
        amount: 10,
        metadata: expect.objectContaining({
          reason: "plan-downgrade",
          "subscription-id": "sub-trigger-update",
        }),
        type: "daily-grant",
      }),
    ]);
  });

  it("does not recreate plan history for a deleting user", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createSubscriptionTestConvex();
    const userId = await t.mutation(async (ctx) => {
      const userId = await insertBillingUser(ctx, {
        credits: 120,
        customerId: "polar-deleting-user",
        plan: "pro",
        suffix: "deleting-user",
      });
      await ctx.db.patch("users", userId, { deletedAt: NOW });
      return userId;
    });

    await t.mutation(internal.subscriptions.mutations.createSubscription, {
      subscription: buildSubscription({
        customerId: "polar-deleting-user",
        productId: products.pro.id,
        status: "canceled",
        subscriptionId: "sub-deleting-user",
      }),
    });

    const state = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.creditTransactions).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.user).toMatchObject({
      credits: 120,
      plan: "pro",
    });
  });
});
