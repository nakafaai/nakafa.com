import posthogTest from "@posthog/convex/test";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  upsertPolarCustomerWebhook,
  upsertPolarSubscriptionWebhook,
} from "@repo/backend/convex/customers/polar/webhook";
import schema from "@repo/backend/convex/schema";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const polarGateway = vi.hoisted(() => ({
  getCustomerById: vi.fn(),
}));

vi.mock("@repo/backend/convex/customers/polar/live", () => ({
  polarGateway,
}));

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);

/** Builds one trigger-capable Convex test deployment. */
function createWebhookTestConvex() {
  const t = convexTest(schema, convexModules);
  posthogTest.register(t);
  return t;
}

/** Inserts one app user that may already be inside account deletion. */
function insertUser(
  ctx: MutationCtx,
  suffix: string,
  deletionPreparedAt?: number
) {
  return ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits: 0,
    creditsResetAt: NOW,
    deletionPreparedAt,
    email: `${suffix}@example.com`,
    name: `User ${suffix}`,
    plan: "free",
  });
}

/** Builds one normalized subscription input at the webhook mutation boundary. */
function buildSubscription(
  customerId: string,
  suffix: string
): SubscriptionRecord {
  const timestamp = new Date(NOW).toISOString();

  return {
    amount: null,
    cancelAtPeriodEnd: false,
    checkoutId: null,
    createdAt: timestamp,
    currency: null,
    currentPeriodEnd: null,
    currentPeriodStart: timestamp,
    customerId,
    endedAt: null,
    id: `subscription-${suffix}`,
    metadata: {},
    modifiedAt: null,
    productId: `product-${suffix}`,
    recurringInterval: null,
    startedAt: timestamp,
    status: "canceled",
  };
}

beforeEach(() => {
  polarGateway.getCustomerById.mockReset();
});

describe("customers/polar/webhook", () => {
  it("resolves the current Polar customer before storing a subscription", async () => {
    const t = createWebhookTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx, "active"));
    const subscription = buildSubscription("polar-active", "active");
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed({
        email: "active@example.com",
        externalId: "auth-active",
        id: subscription.customerId,
        metadata: { userId },
        name: "Active User",
      })
    );

    await t.action((ctx) =>
      Effect.runPromise(
        upsertPolarSubscriptionWebhook(ctx, subscription, "update")
      )
    );

    const state = await t.query(async (ctx) => ({
      customers: await ctx.db.query("customers").collect(),
      subscriptions: await ctx.db.query("subscriptions").collect(),
    }));

    expect(polarGateway.getCustomerById).toHaveBeenCalledWith("polar-active");
    expect(state.customers).toEqual([
      expect.objectContaining({
        id: "polar-active",
        userId,
      }),
    ]);
    expect(state.subscriptions).toEqual([
      expect.objectContaining({
        customerId: "polar-active",
        id: "subscription-active",
      }),
    ]);
  });

  it("discards subscription delivery once its app user starts deletion", async () => {
    const t = createWebhookTestConvex();
    const userId = await t.mutation((ctx) => insertUser(ctx, "pending", NOW));
    const subscription = buildSubscription("polar-pending", "pending");
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed({
        email: "pending@example.com",
        externalId: "auth-pending",
        id: subscription.customerId,
        metadata: { userId },
        name: "Pending User",
      })
    );

    await t.action((ctx) =>
      Effect.runPromise(
        upsertPolarSubscriptionWebhook(ctx, subscription, "create")
      )
    );

    await expect(
      t.query(async (ctx) => ({
        customers: await ctx.db.query("customers").collect(),
        subscriptions: await ctx.db.query("subscriptions").collect(),
      }))
    ).resolves.toEqual({
      customers: [],
      subscriptions: [],
    });
  });

  it("discards subscription delivery for a durable customer tombstone", async () => {
    const t = createWebhookTestConvex();
    const subscription = buildSubscription("polar-deleted", "deleted");
    await t.mutation((ctx) =>
      ctx.db.insert("customerDeletionTombstones", {
        polarCustomerId: subscription.customerId,
      })
    );
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed({
        email: "deleted@example.com",
        externalId: "auth-deleted",
        id: subscription.customerId,
        metadata: {},
        name: "Deleted User",
      })
    );

    await t.action((ctx) =>
      Effect.runPromise(
        upsertPolarSubscriptionWebhook(ctx, subscription, "create")
      )
    );

    await expect(
      t.query(async (ctx) => ({
        customers: await ctx.db.query("customers").collect(),
        subscriptions: await ctx.db.query("subscriptions").collect(),
      }))
    ).resolves.toEqual({
      customers: [],
      subscriptions: [],
    });
  });

  it("discards subscription delivery after Polar removes its customer", async () => {
    const t = createWebhookTestConvex();
    const subscription = buildSubscription("polar-missing", "missing");
    polarGateway.getCustomerById.mockReturnValue(Effect.succeed(null));

    await t.action((ctx) =>
      Effect.runPromise(
        upsertPolarSubscriptionWebhook(ctx, subscription, "create")
      )
    );

    await expect(
      t.query((ctx) => ctx.db.query("subscriptions").collect())
    ).resolves.toEqual([]);
  });

  it("keeps an unknown customer retryable but accepts a tombstoned discard", async () => {
    const t = createWebhookTestConvex();
    const missing = {
      email: "unknown@example.com",
      externalId: "auth-unknown",
      id: "polar-unknown",
      metadata: {},
      name: "Unknown User",
    };

    await expect(
      t.action((ctx) =>
        Effect.runPromise(upsertPolarCustomerWebhook(ctx, missing))
      )
    ).resolves.toBe("missing");

    await t.mutation((ctx) =>
      ctx.db.insert("customerDeletionTombstones", {
        polarCustomerId: missing.id,
      })
    );

    await expect(
      t.action((ctx) =>
        Effect.runPromise(upsertPolarCustomerWebhook(ctx, missing))
      )
    ).resolves.toBe("discarded");
  });

  it("fails closed when Polar metadata and external identity disagree", async () => {
    const t = createWebhookTestConvex();
    const metadataUserId = await t.mutation((ctx) =>
      insertUser(ctx, "metadata-owner")
    );
    await t.mutation((ctx) => insertUser(ctx, "external-owner"));

    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          upsertPolarCustomerWebhook(ctx, {
            email: "conflict@example.com",
            externalId: "auth-external-owner",
            id: "polar-conflict",
            metadata: { userId: metadataUserId },
            name: "Conflicting User",
          })
        )
      )
    ).resolves.toBe("missing");

    await expect(
      t.query((ctx) => ctx.db.query("customers").collect())
    ).resolves.toEqual([]);
  });
});
