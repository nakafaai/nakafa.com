import { beforeEach, describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  upsertPolarCustomerWebhook,
  upsertPolarSubscriptionWebhook,
} from "@repo/backend/convex/customers/polar/webhook";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { convexModules } from "@repo/backend/convex/test.setup";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  getCustomerById: vi.fn(),
}));

vi.mock("@repo/backend/convex/customers/polar/live", () => ({
  polarGateway,
}));

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);

/** Builds one trigger-capable Convex test deployment. */
function createWebhookTestConvex() {
  return Effect.sync(() => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);
    return t;
  });
}

/** Inserts one app user that may already be inside account deletion. */
function insertUser(
  ctx: MutationCtx,
  suffix: string,
  deletionPreparedAt?: number
) {
  return Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `auth-${suffix}`,
      credits: 0,
      creditsResetAt: NOW,
      deletionPreparedAt,
      email: `${suffix}@example.com`,
      name: `User ${suffix}`,
      plan: "free",
    })
  );
}

/** Loads the customer and subscription rows written by one webhook. */
function readWebhookState(ctx: QueryCtx) {
  return Effect.all({
    customers: Effect.promise(() => ctx.db.query("customers").collect()),
    subscriptions: Effect.promise(() =>
      ctx.db.query("subscriptions").collect()
    ),
  });
}

/** Loads the exact revenue state granted by one accepted Pro subscription. */
function readPurchaseCompletionState(
  ctx: QueryCtx,
  userId: Id<"users">,
  polarCustomerId: string,
  subscriptionId: string
) {
  return Effect.all({
    creditTransactions: Effect.promise(() =>
      ctx.db
        .query("creditTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(10)
    ),
    customer: Effect.promise(() =>
      ctx.db
        .query("customers")
        .withIndex("by_polarId", (q) => q.eq("id", polarCustomerId))
        .unique()
    ),
    subscription: Effect.promise(() =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (q) => q.eq("id", subscriptionId))
        .unique()
    ),
    user: Effect.promise(() => ctx.db.get("users", userId)),
  });
}

/** Records one durable Polar customer deletion marker. */
function insertCustomerTombstone(ctx: MutationCtx, polarCustomerId: string) {
  return Effect.promise(() =>
    ctx.db.insert("customerDeletionTombstones", { polarCustomerId })
  );
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
  it.effect("grants the complete Pro entitlement from one Polar webhook", () =>
    Effect.gen(function* () {
      const t = yield* createWebhookTestConvex();
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(insertUser(ctx, "purchase")))
      );
      const subscription = {
        ...buildSubscription("polar-purchase", "purchase"),
        productId: products.pro.id,
        status: "active",
      } satisfies SubscriptionRecord;
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed({
          email: "purchase@example.com",
          externalId: "auth-purchase",
          id: subscription.customerId,
          metadata: { userId },
          name: "User purchase",
        })
      );

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarSubscriptionWebhook(ctx, subscription, "create")
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            readPurchaseCompletionState(
              ctx,
              userId,
              subscription.customerId,
              subscription.id
            )
          )
        )
      );

      expect(disposition).toBe("stored");
      expect(state.customer).toMatchObject({
        id: subscription.customerId,
        userId,
      });
      expect(state.subscription).toMatchObject({
        customerId: subscription.customerId,
        id: subscription.id,
        productId: products.pro.id,
        status: "active",
      });
      expect(state.user).toMatchObject({
        credits: 3000,
        plan: "pro",
      });
      expect(state.creditTransactions).toEqual([
        expect.objectContaining({
          amount: 3000,
          balanceAfter: 3000,
          metadata: {
            "new-plan": "pro",
            "previous-plan": "free",
            reason: "plan-upgrade",
            "subscription-id": subscription.id,
          },
          type: "purchase",
          userId,
        }),
      ]);
    })
  );

  it.effect(
    "resolves the current Polar customer before storing a subscription",
    () =>
      Effect.gen(function* () {
        const t = yield* createWebhookTestConvex();
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertUser(ctx, "active")))
        );
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

        const disposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              upsertPolarSubscriptionWebhook(ctx, subscription, "update")
            )
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
        );

        expect(polarGateway.getCustomerById).toHaveBeenCalledWith(
          "polar-active"
        );
        expect(disposition).toBe("stored");
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
      })
  );

  it.effect(
    "keeps subscription delivery retryable during cancelable preparation",
    () =>
      Effect.gen(function* () {
        const t = yield* createWebhookTestConvex();
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertUser(ctx, "pending", NOW)))
        );
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

        const disposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              upsertPolarSubscriptionWebhook(ctx, subscription, "create")
            )
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
        );

        expect(disposition).toBe("missing");
        expect(state).toEqual({ customers: [], subscriptions: [] });
      })
  );

  it.effect(
    "discards subscription delivery for a durable customer tombstone",
    () =>
      Effect.gen(function* () {
        const t = yield* createWebhookTestConvex();
        const subscription = buildSubscription("polar-deleted", "deleted");
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              insertCustomerTombstone(ctx, subscription.customerId)
            )
          )
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

        const disposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              upsertPolarSubscriptionWebhook(ctx, subscription, "create")
            )
          )
        );
        const state = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
        );

        expect(disposition).toBe("discarded");
        expect(state).toEqual({ customers: [], subscriptions: [] });
      })
  );

  it.effect(
    "discards subscription delivery after Polar removes its customer",
    () =>
      Effect.gen(function* () {
        const t = yield* createWebhookTestConvex();
        const subscription = buildSubscription("polar-missing", "missing");
        polarGateway.getCustomerById.mockReturnValue(Effect.succeed(null));

        const disposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              upsertPolarSubscriptionWebhook(ctx, subscription, "create")
            )
          )
        );
        const subscriptions = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.promise(() => ctx.db.query("subscriptions").collect())
            )
          )
        );

        expect(disposition).toBe("discarded");
        expect(subscriptions).toEqual([]);
      })
  );

  it.effect(
    "keeps an unknown customer retryable but accepts a tombstoned discard",
    () =>
      Effect.gen(function* () {
        const t = yield* createWebhookTestConvex();
        const missing = {
          email: "unknown@example.com",
          externalId: "auth-unknown",
          id: "polar-unknown",
          metadata: {},
          name: "Unknown User",
        };

        const missingDisposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(upsertPolarCustomerWebhook(ctx, missing))
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertCustomerTombstone(ctx, missing.id))
          )
        );
        const discardedDisposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(upsertPolarCustomerWebhook(ctx, missing))
          )
        );

        expect(missingDisposition).toBe("missing");
        expect(discardedDisposition).toBe("discarded");
      })
  );

  it.effect("keeps a subscription retryable until its app user exists", () =>
    Effect.gen(function* () {
      const t = yield* createWebhookTestConvex();
      const subscription = buildSubscription("polar-unknown", "unknown");
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed({
          email: "unknown@example.com",
          externalId: "auth-unknown",
          id: subscription.customerId,
          metadata: {},
          name: "Unknown User",
        })
      );

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarSubscriptionWebhook(ctx, subscription, "create")
          )
        )
      );
      const subscriptions = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.promise(() => ctx.db.query("subscriptions").collect())
          )
        )
      );

      expect(disposition).toBe("missing");
      expect(subscriptions).toEqual([]);
    })
  );

  it.effect(
    "fails closed when Polar metadata and external identity disagree",
    () =>
      Effect.gen(function* () {
        const t = yield* createWebhookTestConvex();
        const metadataUserId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertUser(ctx, "metadata-owner"))
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertUser(ctx, "external-owner"))
          )
        );

        const disposition = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              upsertPolarCustomerWebhook(ctx, {
                email: "conflict@example.com",
                externalId: "auth-external-owner",
                id: "polar-conflict",
                metadata: { userId: metadataUserId },
                name: "Conflicting User",
              })
            )
          )
        );
        const customers = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.promise(() => ctx.db.query("customers").collect())
            )
          )
        );

        expect(disposition).toBe("missing");
        expect(customers).toEqual([]);
      })
  );
});
