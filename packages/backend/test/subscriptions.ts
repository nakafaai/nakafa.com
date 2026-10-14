import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { syncCustomerPlan } from "@repo/backend/confect/triggers/subscriptions/impl";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { DateTime, Effect, Schema } from "effect";

/** The instant that the subscription fixtures are written at. */
export const NOW = Date.UTC(2026, 3, 2, 18, 0, 0);
const SubscriptionInputSchema = Schema.Struct({
  customerId: Schema.String,
  productId: Schema.String,
  status: Schema.String,
  subscriptionId: Schema.String,
});
type SubscriptionInput = typeof SubscriptionInputSchema.Type;

/** Inserts one minimal app user row for subscription-trigger tests. */
export async function insertUser(
  ctx: MutationCtx,
  suffix: string,
  overrides?: Partial<{
    credits: number;
    creditsResetAt: number;
    plan: UserPlan;
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
export async function insertCustomer(
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

/** Builds one subscription payload with a stable timestamp window. */
function buildSubscription({
  customerId,
  productId,
  status,
  subscriptionId,
}: SubscriptionInput) {
  const timestamp = DateTime.formatIso(DateTime.makeUnsafe(NOW));
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

/** Inserts one subscription row with a stable timestamp window. */
export async function insertSubscription(
  ctx: MutationCtx,
  input: SubscriptionInput
) {
  return await ctx.db.insert("subscriptions", buildSubscription(input));
}

/** Loads one subscription by Polar ID and runs the plan sync implementation. */
export function runSyncCustomerPlanBySubscriptionId(
  ctx: MutationCtx,
  subscriptionId: string
) {
  return Effect.gen(function* () {
    const subscription = yield* Effect.promise(() =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (q) => q.eq("id", subscriptionId))
        .unique()
    );
    if (!subscription) {
      return false;
    }
    yield* syncCustomerPlan(subscription).pipe(
      Effect.provide(mutationLayer(confectSchema, ctx))
    );
    return true;
  });
}
