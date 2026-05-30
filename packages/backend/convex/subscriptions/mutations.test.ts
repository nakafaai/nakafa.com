import { internal } from "@repo/backend/convex/_generated/api";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { convexModules } from "@repo/backend/convex/test.setup";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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

describe("subscriptions/mutations", () => {
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
});
