import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { getPlanCreditConfig } from "@repo/backend/confect/modules/commerce/credits.policy";
import { resolveCreditResetTimestamp } from "@repo/backend/confect/modules/commerce/credits.service";
import { getProductsForServer } from "@repo/backend/confect/modules/commerce/polar/products";
import type { Subscriptions } from "@repo/backend/confect/modules/commerce/subscriptions.tables";
import { getOptionalAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import type {
  UserPlan,
  Users,
} from "@repo/backend/confect/modules/identity/users.tables";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Clock, Effect, Option } from "effect";

type SubscriptionFields = typeof Subscriptions.Fields.Type;
type SubscriptionDoc = typeof Subscriptions.Doc.Type;
const ACTIVE_SUBSCRIPTION_SYNC_LIMIT = 50;

const proProductIds = [
  getProductsForServer("production").pro.id,
  getProductsForServer("sandbox").pro.id,
] as const;

/** Maps a Polar product to the app plan it grants. */
function getPlanFromProductId(productId: string): UserPlan {
  if (proProductIds.some((proProductId) => proProductId === productId)) {
    return "pro";
  }

  return "free";
}

/** Chooses the plan with the highest credit grant. */
function getHigherPlan(currentPlan: UserPlan, nextPlan: UserPlan) {
  const currentCredits = getPlanCreditConfig(currentPlan).amount;
  const nextCredits = getPlanCreditConfig(nextPlan).amount;

  return nextCredits > currentCredits ? nextPlan : currentPlan;
}

/** Applies the persisted plan and credit state for one subscription transition. */
const applyPlanChange = Effect.fnUntraced(function* (
  ctx: ConvexMutationCtx,
  args: {
    newPlan: UserPlan;
    now: number;
    subscription: SubscriptionDoc;
    user: typeof Users.Doc.Type;
  }
) {
  const writer = yield* DatabaseWriter;
  const previousPlan = args.user.plan;
  const newCreditConfig = getPlanCreditConfig(args.newPlan);
  const nextResetTimestamp = yield* resolveCreditResetTimestamp({
    now: args.now,
    plan: args.newPlan,
  });

  yield* writer.table("users").patch(args.user._id, {
    credits: newCreditConfig.amount,
    creditsResetAt: nextResetTimestamp,
    plan: args.newPlan,
  });

  yield* writer.table("creditTransactions").insert({
    amount: newCreditConfig.amount,
    balanceAfter: newCreditConfig.amount,
    metadata: {
      "new-plan": args.newPlan,
      "previous-plan": previousPlan,
      reason: args.newPlan === "pro" ? "plan-upgrade" : "plan-downgrade",
      "subscription-id": args.subscription.id,
    },
    type: args.newPlan === "pro" ? "purchase" : newCreditConfig.grantType,
    userId: args.user._id,
  });

  const timestamp = new Date(args.now);
  const eventName =
    args.newPlan === "pro" ? "subscription started" : "subscription canceled";

  if (args.newPlan === "pro" || args.subscription.status === "canceled") {
    yield* Effect.promise(() =>
      captureProductEvent(ctx, {
        distinctId: args.user._id,
        event: {
          name: eventName,
          properties: {
            product_id: args.subscription.productId,
            status: args.subscription.status,
            subscription_id: args.subscription.id,
          },
        },
        timestamp,
      })
    );
  }

  yield* Effect.promise(() =>
    captureProductEvent(ctx, {
      distinctId: args.user._id,
      event: {
        name: "plan changed",
        properties: {
          new_plan: args.newPlan,
          previous_plan: previousPlan,
          subscription_id: args.subscription.id,
        },
      },
      timestamp,
    })
  );

  return null;
});

/** Recomputes the effective user plan after a subscription write. */
const syncCustomerPlan = Effect.fnUntraced(function* (
  ctx: ConvexMutationCtx,
  subscription: SubscriptionDoc
) {
  const reader = yield* DatabaseReader;
  const customerOption = yield* reader
    .table("customers")
    .index("by_polarId", (query) => query.eq("id", subscription.customerId))
    .first();
  const customer = Option.getOrNull(customerOption);

  if (!customer) {
    return null;
  }

  const user = yield* reader
    .table("users")
    .get(customer.userId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!user) {
    return null;
  }

  const activeSubscriptions = yield* reader
    .table("subscriptions")
    .index("by_customerId_and_status", (query) =>
      query.eq("customerId", subscription.customerId).eq("status", "active")
    )
    .take(ACTIVE_SUBSCRIPTION_SYNC_LIMIT);

  let newPlan: UserPlan = "free";
  let planChangeSubscription = subscription;

  for (const activeSubscription of activeSubscriptions) {
    const rowPlan = getPlanFromProductId(activeSubscription.productId);
    const highestPlan = getHigherPlan(newPlan, rowPlan);

    if (highestPlan === newPlan) {
      continue;
    }

    newPlan = highestPlan;
    planChangeSubscription = activeSubscription;
  }

  if (newPlan === user.plan) {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;
  yield* applyPlanChange(ctx, {
    newPlan,
    now,
    subscription: planChangeSubscription,
    user,
  });

  return null;
});

/** Creates a subscription unless the Polar subscription id already exists. */
export const createSubscription = Effect.fnUntraced(function* (args: {
  subscription: SubscriptionFields;
}) {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingSubscriptionOption = yield* reader
    .table("subscriptions")
    .index("by_subscriptionId", (query) => query.eq("id", args.subscription.id))
    .first();
  const existingSubscription = Option.getOrNull(existingSubscriptionOption);

  if (existingSubscription) {
    yield* syncCustomerPlan(ctx, existingSubscription);
    return existingSubscription._id;
  }

  const subscriptionId = yield* writer
    .table("subscriptions")
    .insert(args.subscription);
  const subscription = yield* reader
    .table("subscriptions")
    .get(subscriptionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (subscription) {
    yield* syncCustomerPlan(ctx, subscription);
  }

  return subscriptionId;
});

/** Upserts a subscription by Polar subscription id. */
export const updateSubscription = Effect.fnUntraced(function* (args: {
  subscription: SubscriptionFields;
}) {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingSubscriptionOption = yield* reader
    .table("subscriptions")
    .index("by_subscriptionId", (query) => query.eq("id", args.subscription.id))
    .first();
  const existingSubscription = Option.getOrNull(existingSubscriptionOption);

  if (!existingSubscription) {
    const subscriptionId = yield* writer
      .table("subscriptions")
      .insert(args.subscription);
    const subscription = yield* reader
      .table("subscriptions")
      .get(subscriptionId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (subscription) {
      yield* syncCustomerPlan(ctx, subscription);
    }

    return null;
  }

  yield* writer
    .table("subscriptions")
    .patch(existingSubscription._id, args.subscription);
  const subscription = yield* reader
    .table("subscriptions")
    .get(existingSubscription._id)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (subscription) {
    yield* syncCustomerPlan(ctx, subscription);
  }

  return null;
});

/** Returns whether the current user has an active subscription for a product. */
export const hasActiveSubscription = Effect.fnUntraced(function* (args: {
  productId: string;
}) {
  const reader = yield* DatabaseReader;
  const user = yield* getOptionalAppUser();

  if (!user) {
    return false;
  }

  const customerOption = yield* reader
    .table("customers")
    .index("by_userId", (query) => query.eq("userId", user.appUser._id))
    .first();
  const customer = Option.getOrNull(customerOption);

  if (!customer) {
    return false;
  }

  const subscriptionOption = yield* reader
    .table("subscriptions")
    .index("by_customerId_and_status_and_productId", (query) =>
      query
        .eq("customerId", customer.id)
        .eq("status", "active")
        .eq("productId", args.productId)
    )
    .first();

  return Option.isSome(subscriptionOption);
});
