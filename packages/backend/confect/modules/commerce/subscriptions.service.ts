import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  getPlanCreditConfig,
  resolveCurrentCreditResetTimestamp,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import { getProductsForServer } from "@repo/backend/confect/modules/commerce/polar/products";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import type { UserPlan } from "@repo/backend/confect/modules/identity/users.tables";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Clock, Effect } from "effect";

type SubscriptionFields = Omit<Doc<"subscriptions">, "_creationTime" | "_id">;
type SubscriptionDoc = Doc<"subscriptions">;
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
const applyPlanChange = Effect.fn("commerce.applyPlanChange")(function* (
  ctx: ConvexMutationCtx,
  args: {
    newPlan: UserPlan;
    now: number;
    subscription: SubscriptionDoc;
    user: Doc<"users">;
  }
) {
  const previousPlan = args.user.plan;
  const newCreditConfig = getPlanCreditConfig(args.newPlan);
  const nextResetTimestamp = yield* Effect.promise(() =>
    resolveCurrentCreditResetTimestamp(ctx.db, args.newPlan, args.now)
  );

  yield* Effect.promise(() =>
    ctx.db.patch(args.user._id, {
      credits: newCreditConfig.amount,
      creditsResetAt: nextResetTimestamp,
      plan: args.newPlan,
    })
  );

  yield* Effect.promise(() =>
    ctx.db.insert("creditTransactions", {
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
    })
  );

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
const syncCustomerPlan = Effect.fn("commerce.syncCustomerPlan")(function* (
  ctx: ConvexMutationCtx,
  subscription: SubscriptionDoc
) {
  const customer = yield* Effect.promise(() =>
    ctx.db
      .query("customers")
      .withIndex("by_polarId", (query) =>
        query.eq("id", subscription.customerId)
      )
      .unique()
  );

  if (!customer) {
    yield* Effect.logWarning("Subscription customer was not found.", {
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
    });
    return null;
  }

  const user = yield* Effect.promise(() => ctx.db.get(customer.userId));

  if (!user) {
    yield* Effect.logWarning("Subscription user was not found.", {
      subscriptionId: subscription.id,
      userId: customer.userId,
    });
    return null;
  }

  const activeSubscriptions = yield* Effect.promise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status", (query) =>
        query.eq("customerId", subscription.customerId).eq("status", "active")
      )
      .take(ACTIVE_SUBSCRIPTION_SYNC_LIMIT)
  );

  if (activeSubscriptions.length === ACTIVE_SUBSCRIPTION_SYNC_LIMIT) {
    yield* Effect.logWarning(
      "Subscription sync reached the active row limit.",
      {
        customerId: subscription.customerId,
        limit: ACTIVE_SUBSCRIPTION_SYNC_LIMIT,
      }
    );
  }

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
export const createSubscription = Effect.fn("commerce.createSubscription")(
  function* (args: { subscription: SubscriptionFields }) {
    const ctx = yield* MutationCtx;
    const existingSubscription = yield* Effect.promise(() =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (query) =>
          query.eq("id", args.subscription.id)
        )
        .unique()
    );

    if (existingSubscription) {
      yield* syncCustomerPlan(ctx, existingSubscription);
      return existingSubscription._id;
    }

    const subscriptionId = yield* Effect.promise(() =>
      ctx.db.insert("subscriptions", args.subscription)
    );
    const subscription = yield* Effect.promise(() =>
      ctx.db.get(subscriptionId)
    );

    if (subscription) {
      yield* syncCustomerPlan(ctx, subscription);
    }

    return subscriptionId;
  }
);

/** Upserts a subscription by Polar subscription id. */
export const updateSubscription = Effect.fn("commerce.updateSubscription")(
  function* (args: { subscription: SubscriptionFields }) {
    const ctx = yield* MutationCtx;
    const existingSubscription = yield* Effect.promise(() =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (query) =>
          query.eq("id", args.subscription.id)
        )
        .unique()
    );

    if (!existingSubscription) {
      const subscriptionId = yield* Effect.promise(() =>
        ctx.db.insert("subscriptions", args.subscription)
      );
      const subscription = yield* Effect.promise(() =>
        ctx.db.get(subscriptionId)
      );

      if (subscription) {
        yield* syncCustomerPlan(ctx, subscription);
      }

      return null;
    }

    yield* Effect.promise(() =>
      ctx.db.patch(existingSubscription._id, args.subscription)
    );
    const subscription = yield* Effect.promise(() =>
      ctx.db.get(existingSubscription._id)
    );

    if (subscription) {
      yield* syncCustomerPlan(ctx, subscription);
    }

    return null;
  }
);

/** Returns whether the current user has an active subscription for a product. */
export const hasActiveSubscription = Effect.fn(
  "commerce.hasActiveSubscription"
)(function* (args: { productId: string }) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const customer = yield* Effect.promise(() =>
    ctx.db
      .query("customers")
      .withIndex("by_userId", (query) => query.eq("userId", user.appUser._id))
      .unique()
  );

  if (!customer) {
    return false;
  }

  const subscription = yield* Effect.promise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status_and_productId", (query) =>
        query
          .eq("customerId", customer.id)
          .eq("status", "active")
          .eq("productId", args.productId)
      )
      .first()
  );

  return subscription !== null;
});

/** Subscription service accessors used by Confect function implementations. */
export class Subscriptions extends Effect.Service<Subscriptions>()(
  "Subscriptions",
  {
    accessors: true,
    succeed: {
      createSubscription,
      hasActiveSubscription,
      updateSubscription,
    },
  }
) {}
