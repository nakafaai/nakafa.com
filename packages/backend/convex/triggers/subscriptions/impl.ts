import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import { resolveCurrentCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  SubscriptionPlanSyncIoError,
  subscriptionPlanSyncIoFailedCode,
} from "@repo/backend/convex/triggers/subscriptions/spec";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar/products";
import { Clock, Effect } from "effect";

const freePlan = "free" satisfies UserPlan;
const proPlan = "pro" satisfies UserPlan;
const activeSubscriptionStatus = "active";
const canceledSubscriptionStatus = "canceled";

const productToPlan: ReadonlyMap<string, UserPlan> = new Map([
  [products.pro.id, proPlan],
]);

type SubscriptionDoc = Doc<"subscriptions">;
type UserDoc = Doc<"users">;

/** Maps thrown Convex IO failures into the subscription trigger error channel. */
function toSubscriptionPlanSyncIoError(error: unknown) {
  return new SubscriptionPlanSyncIoError({
    code: subscriptionPlanSyncIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Maps one Polar product ID to the app plan it grants. */
function getPlanFromProductId(productId: SubscriptionDoc["productId"]) {
  return productToPlan.get(productId) ?? freePlan;
}

/** Keeps the plan with the larger credit allowance. */
function getHigherPlan(currentPlan: UserPlan, nextPlan: UserPlan) {
  const currentCredits = getPlanCreditConfig(currentPlan).amount;
  const nextCredits = getPlanCreditConfig(nextPlan).amount;

  return nextCredits > currentCredits ? nextPlan : currentPlan;
}

/** Loads the app customer linked to one Polar customer ID. */
const loadCustomer = Effect.fn("triggers.subscriptions.loadCustomer")(
  function* (db: MutationCtx["db"], customerId: SubscriptionDoc["customerId"]) {
    return yield* Effect.tryPromise({
      try: () =>
        db
          .query("customers")
          .withIndex("by_polarId", (q) => q.eq("id", customerId))
          .unique(),
      catch: toSubscriptionPlanSyncIoError,
    });
  }
);

/** Loads active subscription rows that still grant the customer access. */
const loadActiveSubscriptions = Effect.fn(
  "triggers.subscriptions.loadActiveSubscriptions"
)(function* (db: MutationCtx["db"], customerId: SubscriptionDoc["customerId"]) {
  return yield* Effect.tryPromise({
    try: () =>
      db
        .query("subscriptions")
        .withIndex("by_customerId_and_status", (q) =>
          q.eq("customerId", customerId).eq("status", activeSubscriptionStatus)
        )
        .collect(),
    catch: toSubscriptionPlanSyncIoError,
  });
});

/** Derives the user's effective plan from the customer's active subscriptions. */
function deriveCustomerPlan(
  activeSubscriptions: readonly SubscriptionDoc[],
  fallbackSubscription: SubscriptionDoc
) {
  let plan: UserPlan = freePlan;
  let sourceSubscription = fallbackSubscription;

  for (const subscription of activeSubscriptions) {
    const subscriptionPlan = getPlanFromProductId(subscription.productId);
    const higherPlan = getHigherPlan(plan, subscriptionPlan);

    if (higherPlan === plan) {
      continue;
    }

    plan = higherPlan;
    sourceSubscription = subscription;
  }

  return { plan, sourceSubscription };
}

/** Applies one durable user plan update and the matching credit transaction. */
const applyPlanChange = Effect.fn("triggers.subscriptions.applyPlanChange")(
  function* (
    ctx: MutationCtx,
    user: UserDoc,
    newPlan: UserPlan,
    now: number,
    subscription: SubscriptionDoc
  ) {
    const previousPlan = user.plan;
    const timestamp = new Date(now);
    const newCreditConfig = getPlanCreditConfig(newPlan);
    const nextResetTimestamp = yield* Effect.tryPromise({
      try: () => resolveCurrentCreditResetTimestamp(ctx.db, newPlan, now),
      catch: toSubscriptionPlanSyncIoError,
    });

    if (newPlan === proPlan) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch("users", user._id, {
            plan: newPlan,
            credits: newCreditConfig.amount,
            creditsResetAt: nextResetTimestamp,
          }),
        catch: toSubscriptionPlanSyncIoError,
      });

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.insert("creditTransactions", {
            userId: user._id,
            amount: newCreditConfig.amount,
            type: "purchase",
            balanceAfter: newCreditConfig.amount,
            metadata: {
              reason: "plan-upgrade",
              "previous-plan": previousPlan,
              "new-plan": newPlan,
              "subscription-id": subscription.id,
            },
          }),
        catch: toSubscriptionPlanSyncIoError,
      });

      yield* Effect.sync(() =>
        logger.info("User upgraded with credits", {
          userId: user._id,
          subscriptionId: subscription.id,
          creditsGranted: newCreditConfig.amount,
          previousPlan,
          newPlan,
        })
      );

      yield* Effect.tryPromise({
        try: () =>
          captureProductEvent(ctx, {
            distinctId: user._id,
            event: {
              name: "subscription started",
              properties: {
                product_id: subscription.productId,
                status: subscription.status,
                subscription_id: subscription.id,
              },
            },
            timestamp,
          }),
        catch: toSubscriptionPlanSyncIoError,
      });

      yield* Effect.tryPromise({
        try: () =>
          captureProductEvent(ctx, {
            distinctId: user._id,
            event: {
              name: "plan changed",
              properties: {
                new_plan: newPlan,
                previous_plan: previousPlan,
                subscription_id: subscription.id,
              },
            },
            timestamp,
          }),
        catch: toSubscriptionPlanSyncIoError,
      });

      return;
    }

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch("users", user._id, {
          plan: newPlan,
          credits: newCreditConfig.amount,
          creditsResetAt: nextResetTimestamp,
        }),
      catch: toSubscriptionPlanSyncIoError,
    });

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("creditTransactions", {
          userId: user._id,
          amount: newCreditConfig.amount,
          type: newCreditConfig.grantType,
          balanceAfter: newCreditConfig.amount,
          metadata: {
            reason: "plan-downgrade",
            "previous-plan": previousPlan,
            "new-plan": newPlan,
            "subscription-id": subscription.id,
          },
        }),
      catch: toSubscriptionPlanSyncIoError,
    });

    yield* Effect.sync(() =>
      logger.info("User downgraded, credits adjusted", {
        userId: user._id,
        subscriptionId: subscription.id,
        newCredits: newCreditConfig.amount,
        previousPlan,
        newPlan,
      })
    );

    if (subscription.status === canceledSubscriptionStatus) {
      yield* Effect.tryPromise({
        try: () =>
          captureProductEvent(ctx, {
            distinctId: user._id,
            event: {
              name: "subscription canceled",
              properties: {
                product_id: subscription.productId,
                status: subscription.status,
                subscription_id: subscription.id,
              },
            },
            timestamp,
          }),
        catch: toSubscriptionPlanSyncIoError,
      });
    }

    yield* Effect.tryPromise({
      try: () =>
        captureProductEvent(ctx, {
          distinctId: user._id,
          event: {
            name: "plan changed",
            properties: {
              new_plan: newPlan,
              previous_plan: previousPlan,
              subscription_id: subscription.id,
            },
          },
          timestamp,
        }),
      catch: toSubscriptionPlanSyncIoError,
    });
  }
);

/**
 * Recomputes the effective app plan after one subscription row changes.
 *
 * The trigger keeps this as an indexed, local mutation flow: customer by Polar
 * ID, linked user by document ID, active subscription rows by customer/status,
 * then a bounded user and credit update.
 * @see https://docs.convex.dev/understanding/best-practices/
 * @see https://docs.convex.dev/database/advanced/occ
 * @see https://effect.website/docs/error-management/expected-errors/
 */
export const syncCustomerPlan = Effect.fn(
  "triggers.subscriptions.syncCustomerPlan"
)(function* (ctx: MutationCtx, subscription: SubscriptionDoc) {
  const customer = yield* loadCustomer(ctx.db, subscription.customerId);

  if (!customer) {
    yield* Effect.sync(() =>
      logger.warn("Subscription trigger: Customer not found", {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
      })
    );
    return;
  }

  const user = yield* Effect.tryPromise({
    try: () => ctx.db.get("users", customer.userId),
    catch: toSubscriptionPlanSyncIoError,
  });

  if (!user) {
    yield* Effect.sync(() =>
      logger.warn("Subscription trigger: User not found", {
        userId: customer.userId,
        subscriptionId: subscription.id,
      })
    );
    return;
  }

  const now = yield* Clock.currentTimeMillis;
  const activeSubscriptions = yield* loadActiveSubscriptions(
    ctx.db,
    subscription.customerId
  );
  const { plan, sourceSubscription } = deriveCustomerPlan(
    activeSubscriptions,
    subscription
  );

  if (plan === user.plan) {
    return;
  }

  yield* applyPlanChange(ctx, user, plan, now, sourceSubscription);
});
