import type { models, webhooks } from "@polar-sh/sdk/2026-10";
import posthogTest from "@posthog/convex/test";
import type { StoredPolarCustomer } from "@repo/backend/confect/customers/polar/spec";
import type { SubscriptionRecord } from "@repo/backend/confect/subscriptions/records/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { DateTime, Effect } from "effect";

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
  const timestamp = DateTime.formatIso(DateTime.makeUnsafe(NOW));

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

/** A Polar individual customer as the 2026-10 API returns it. */
export const polarCustomer = {
  avatar_url: null,
  billing_address: null,
  billing_name: null,
  created_at: "2026-09-01T00:00:00.000Z",
  deleted_at: null,
  email: "subscriber@example.com",
  email_verified: true,
  first_user_event_at: null,
  id: "customer",
  metadata: {},
  modified_at: null,
  name: "Subscriber",
  organization_id: "organization",
  tax_id: null,
  type: "individual",
} satisfies models.CustomerIndividual;

/** A Polar product as the 2026-10 API returns it. */
export const polarProduct = {
  attached_custom_fields: [],
  benefits: [],
  created_at: "2026-09-01T00:00:00.000Z",
  description: null,
  id: "product",
  is_archived: false,
  is_deletable: true,
  is_recurring: true,
  meter_interval: null,
  meter_interval_count: null,
  medias: [],
  metadata: {},
  modified_at: null,
  name: "Pro",
  organization_id: "organization",
  prices: [],
  recurring_interval: "month",
  recurring_interval_count: 1,
  trial_interval: null,
  trial_interval_count: null,
  visibility: "public",
} satisfies models.Product;

/** A Polar subscription as the 2026-10 API returns it, with ISO date-times. */
export const polarSubscription = {
  amount: 1000,
  cancel_at_period_end: false,
  canceled_at: null,
  checkout_id: null,
  created_at: "2026-09-01T00:00:00.000Z",
  currency: "usd",
  current_meter_period_end: null,
  current_meter_period_start: null,
  current_period_end: "2026-10-01T00:00:00.000Z",
  current_period_start: "2026-09-01T00:00:00.000Z",
  customer: polarCustomer,
  customer_cancellation_comment: null,
  customer_cancellation_reason: null,
  customer_id: "customer",
  discount: null,
  discount_id: null,
  ended_at: null,
  ends_at: null,
  id: "subscription",
  meters: [],
  metadata: {},
  modified_at: null,
  pause_at_period_end: false,
  paused_at: null,
  pending_update: null,
  prices: [],
  product: polarProduct,
  product_id: "product",
  recurring_interval: "month",
  recurring_interval_count: 1,
  resumes_at: null,
  started_at: null,
  status: "active",
  trial_end: null,
  trial_start: null,
  units: null,
} satisfies models.Subscription;
/** Builds one trigger-capable Convex test deployment. */
export function createWebhookTestConvex() {
  const t = convexTest(schema, convexModules);
  posthogTest.register(t);
  return t;
}

/** Inserts a user row for customer reconciliation tests. */
export const insertReconciliationUser = Effect.fn(
  "customers.mutations.test.insertUser"
)(function* (ctx: MutationCtx, suffix: string) {
  return yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `auth-${suffix}`,
      credits: 10,
      creditsResetAt: 1,
      email: `${suffix}@example.com`,
      name: suffix,
      plan: "free",
    })
  );
});

/** Inserts a local customer row owned by one user. */
export const insertOwnedCustomer = Effect.fn(
  "customers.mutations.test.insertCustomer"
)(function* (ctx: MutationCtx, polarId: string, userId: Id<"users">) {
  return yield* Effect.promise(() =>
    ctx.db.insert("customers", {
      id: polarId,
      externalId: null,
      metadata: {},
      userId,
    })
  );
});

/** Seeds one webhook account through the test transaction boundary. */
export const seedWebhookUser = Effect.fn("test.polar.seedUser")(
  (
    t: ReturnType<typeof createWebhookTestConvex>,
    suffix: string,
    deletionPreparedAt?: number
  ) =>
    Effect.promise(() =>
      t.mutation((ctx) =>
        Effect.runPromise(insertUser(ctx, suffix, deletionPreparedAt))
      )
    )
);

/** Builds the normalized identity delivered by Polar to a billing webhook. */
export function buildWebhookCustomer(
  suffix: string,
  overrides: Partial<StoredPolarCustomer> = {}
): StoredPolarCustomer {
  return {
    email: `${suffix}@example.com`,
    externalId: `auth-${suffix}`,
    id: `polar-${suffix}`,
    metadata: {},
    name: `User ${suffix}`,
    ...overrides,
  };
}

/** Wraps one Polar payload in the envelope every verified webhook carries. */
export function buildWebhookEvent<Type extends webhooks.WebhookPayload["type"]>(
  type: Type,
  data: Extract<webhooks.WebhookPayload, { type: Type }>["data"]
) {
  return {
    api_version: "2026-10",
    data,
    timestamp: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
    type,
  };
}
