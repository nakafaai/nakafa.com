import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
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

type SubscriptionDoc = Doc<"subscriptions">;
type UserDoc = Doc<"users">;

/** Maps thrown Convex IO failures into the subscription trigger error channel. */
function toSubscriptionPlanSyncIoError(error: unknown) {
  return new SubscriptionPlanSyncIoError({
    code: subscriptionPlanSyncIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
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

/** Loads the earliest active Pro subscription that grants the customer a plan. */
const loadActiveProSubscription = Effect.fn(
  "triggers.subscriptions.loadActiveProSubscription"
)(function* (db: MutationCtx["db"], customerId: SubscriptionDoc["customerId"]) {
  return yield* Effect.tryPromise({
    try: () =>
      db
        .query("subscriptions")
        .withIndex("by_customerId_and_status_and_productId", (q) =>
          q
            .eq("customerId", customerId)
            .eq("status", activeSubscriptionStatus)
            .eq("productId", products.pro.id)
        )
        .first(),
    catch: toSubscriptionPlanSyncIoError,
  });
});

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
      const planCreditGrantId = yield* Effect.tryPromise({
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

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch("users", user._id, {
            plan: newPlan,
            credits: newCreditConfig.amount,
            creditsResetAt: nextResetTimestamp,
            planCreditGrantId,
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

      yield* captureProductEvent(ctx, {
        distinctId: user._id,
        event: {
          name: "subscription started",
          properties: {
            product_id: subscription.productId,
            status: subscription.status,
          },
        },
        timestamp,
      });

      yield* captureProductEvent(ctx, {
        distinctId: user._id,
        event: {
          name: "plan changed",
          properties: {
            new_plan: newPlan,
            previous_plan: previousPlan,
          },
        },
        timestamp,
      });

      return;
    }
    const planCreditGrantId = yield* Effect.tryPromise({
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

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch("users", user._id, {
          plan: newPlan,
          credits: newCreditConfig.amount,
          creditsResetAt: nextResetTimestamp,
          planCreditGrantId,
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
      yield* captureProductEvent(ctx, {
        distinctId: user._id,
        event: {
          name: "subscription canceled",
          properties: {
            product_id: subscription.productId,
            status: subscription.status,
          },
        },
        timestamp,
      });
    }

    yield* captureProductEvent(ctx, {
      distinctId: user._id,
      event: {
        name: "plan changed",
        properties: {
          new_plan: newPlan,
          previous_plan: previousPlan,
        },
      },
      timestamp,
    });
  }
);

/**
 * Recomputes the effective app plan after one subscription row changes.
 *
 * The trigger keeps this as an indexed, local mutation flow: customer by Polar
 * ID, linked user by document ID, one active Pro subscription by indexed identity,
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

  if (isAccountDeletionPending(user)) {
    return;
  }

  const now = yield* Clock.currentTimeMillis;
  const activeSubscription = yield* loadActiveProSubscription(
    ctx.db,
    subscription.customerId
  );
  const plan = activeSubscription ? proPlan : freePlan;
  const sourceSubscription = activeSubscription ?? subscription;

  if (plan === user.plan) {
    return;
  }

  yield* applyPlanChange(ctx, user, plan, now, sourceSubscription);
});
