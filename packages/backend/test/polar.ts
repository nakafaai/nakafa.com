import type { Subscription } from "@polar-sh/sdk/models/components/subscription";
import posthogTest from "@posthog/convex/test";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);
/** Inserts one app user that may already be inside account deletion. */
export function insertUser(
  ctx: MutationCtx,
  suffix: string,
  deletionPreparedAt?: number
) {
  return Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `auth-${suffix}`,
      credits: 0,
      creditsResetAt: NOW,
      ...(deletionPreparedAt === undefined ? {} : { deletionPreparedAt }),
      email: `${suffix}@example.com`,
      name: `User ${suffix}`,
      plan: "free",
    })
  );
}

/** Loads the customer and subscription rows written by one webhook. */
export function readWebhookState(ctx: QueryCtx) {
  return Effect.all({
    customers: Effect.promise(() => ctx.db.query("customers").collect()),
    subscriptions: Effect.promise(() =>
      ctx.db.query("subscriptions").collect()
    ),
  });
}

/** Loads the exact revenue state granted by one accepted Pro subscription. */
export function readPurchaseCompletionState(
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
export function insertCustomerTombstone(
  ctx: MutationCtx,
  polarCustomerId: string
) {
  return Effect.promise(() =>
    ctx.db.insert("customerDeletionTombstones", { polarCustomerId })
  );
}

/** Builds one normalized subscription input at the webhook mutation boundary. */
export function buildSubscription(
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

export const polarTimestamp = new Date("2026-09-01T00:00:00.000Z");
export const polarSubscription = {
  amount: 1000,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  checkoutId: null,
  createdAt: polarTimestamp,
  currency: "usd",
  currentMeterPeriodEnd: null,
  currentMeterPeriodStart: null,
  currentPeriodEnd: polarTimestamp,
  currentPeriodStart: polarTimestamp,
  customer: {
    avatarUrl: null,
    billingAddress: null,
    billingName: null,
    createdAt: polarTimestamp,
    deletedAt: null,
    emailVerified: true,
    id: "customer",
    metadata: {},
    modifiedAt: null,
    name: "Subscriber",
    organizationId: "organization",
    taxId: null,
    type: "individual",
  },
  customerCancellationComment: null,
  customerCancellationReason: null,
  customerId: "customer",
  discount: null,
  discountId: null,
  endedAt: null,
  endsAt: null,
  id: "subscription",
  metadata: {},
  meters: [],
  modifiedAt: null,
  pauseAtPeriodEnd: false,
  pausedAt: null,
  pendingUpdate: null,
  prices: [],
  product: {
    attachedCustomFields: [],
    benefits: [],
    createdAt: polarTimestamp,
    description: null,
    id: "product",
    isArchived: false,
    isRecurring: true,
    medias: [],
    metadata: {},
    meterInterval: null,
    meterIntervalCount: null,
    modifiedAt: null,
    name: "Pro",
    organizationId: "organization",
    prices: [],
    recurringInterval: "month",
    recurringIntervalCount: 1,
    trialInterval: null,
    trialIntervalCount: null,
    visibility: "public",
  },
  productId: "product",
  recurringInterval: "month",
  recurringIntervalCount: 1,
  resumesAt: null,
  startedAt: null,
  status: "active",
  trialEnd: null,
  trialStart: null,
} satisfies Subscription;
/** Builds one trigger-capable Convex test deployment. */
export function createWebhookTestConvex() {
  const t = convexTest(schema, convexModules);
  posthogTest.register(t);
  return t;
}
