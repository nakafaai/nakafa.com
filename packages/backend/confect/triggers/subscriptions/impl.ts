import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { resolveCurrentCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { products } from "@repo/backend/confect/customers/polar/products";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  SubscriptionPlanSyncIoError,
  subscriptionPlanSyncIoFailedCode,
} from "@repo/backend/confect/triggers/subscriptions/spec";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Clock, Effect, flow, Option } from "effect";

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
  function* (customerId: SubscriptionDoc["customerId"]) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("customers")
      .get("by_polarId", customerId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toSubscriptionPlanSyncIoError, Effect.fail))
);

/** Loads the earliest active Pro subscription that grants the customer a plan. */
const loadActiveProSubscription = Effect.fn(
  "triggers.subscriptions.loadActiveProSubscription"
)(
  function* (customerId: SubscriptionDoc["customerId"]) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("subscriptions")
      .index("by_customerId_and_status_and_productId", (q) =>
        q
          .eq("customerId", customerId)
          .eq("status", activeSubscriptionStatus)
          .eq("productId", products.pro.id)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  },
  Effect.catchDefect(flow(toSubscriptionPlanSyncIoError, Effect.fail))
);

/** Applies one durable user plan update and the matching credit transaction. */
const applyPlanChange = Effect.fn("triggers.subscriptions.applyPlanChange")(
  function* (
    user: UserDoc,
    newPlan: UserPlan,
    now: number,
    subscription: SubscriptionDoc
  ) {
    const writer = yield* DatabaseWriter;
    const previousPlan = user.plan;
    const newCreditConfig = getPlanCreditConfig(newPlan);
    const nextResetTimestamp = yield* resolveCurrentCreditResetTimestamp(
      newPlan,
      now
    ).pipe(Effect.mapError(toSubscriptionPlanSyncIoError));
    if (newPlan === proPlan) {
      const planCreditGrantId = yield* writer
        .table("creditTransactions")
        .insert({
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
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("users")
        .patch(user._id, {
          plan: newPlan,
          credits: newCreditConfig.amount,
          creditsResetAt: nextResetTimestamp,
          planCreditGrantId,
        })
        .pipe(Effect.orDie);
      yield* Effect.logInfo("User upgraded with credits").pipe(
        Effect.annotateLogs({
          userId: user._id,
          subscriptionId: subscription.id,
          creditsGranted: newCreditConfig.amount,
          previousPlan,
          newPlan,
        })
      );
      yield* captureProductEvent({
        distinctId: user._id,
        event: {
          name: "subscription started",
          properties: {
            product_id: subscription.productId,
            status: subscription.status,
          },
        },
        timestamp: now,
      });
      yield* captureProductEvent({
        distinctId: user._id,
        event: {
          name: "plan changed",
          properties: {
            new_plan: newPlan,
            previous_plan: previousPlan,
          },
        },
        timestamp: now,
      });
      return;
    }
    const planCreditGrantId = yield* writer
      .table("creditTransactions")
      .insert({
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
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("users")
      .patch(user._id, {
        plan: newPlan,
        credits: newCreditConfig.amount,
        creditsResetAt: nextResetTimestamp,
        planCreditGrantId,
      })
      .pipe(Effect.orDie);
    yield* Effect.logInfo("User downgraded, credits adjusted").pipe(
      Effect.annotateLogs({
        userId: user._id,
        subscriptionId: subscription.id,
        newCredits: newCreditConfig.amount,
        previousPlan,
        newPlan,
      })
    );
    if (subscription.status === canceledSubscriptionStatus) {
      yield* captureProductEvent({
        distinctId: user._id,
        event: {
          name: "subscription canceled",
          properties: {
            product_id: subscription.productId,
            status: subscription.status,
          },
        },
        timestamp: now,
      });
    }
    yield* captureProductEvent({
      distinctId: user._id,
      event: {
        name: "plan changed",
        properties: {
          new_plan: newPlan,
          previous_plan: previousPlan,
        },
      },
      timestamp: now,
    });
  },
  Effect.catchDefect(flow(toSubscriptionPlanSyncIoError, Effect.fail))
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
)(
  function* (subscription: SubscriptionDoc) {
    const database = yield* DatabaseReader;
    const customer = yield* loadCustomer(subscription.customerId);
    if (!customer) {
      yield* Effect.logWarning("Subscription trigger: Customer not found").pipe(
        Effect.annotateLogs({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
        })
      );
      return;
    }
    const user = yield* database
      .table("users")
      .get(customer.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user) {
      yield* Effect.logWarning("Subscription trigger: User not found").pipe(
        Effect.annotateLogs({
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
      subscription.customerId
    );
    const plan = activeSubscription ? proPlan : freePlan;
    const sourceSubscription = activeSubscription ?? subscription;
    if (plan === user.plan) {
      return;
    }
    yield* applyPlanChange(user, plan, now, sourceSubscription);
  },
  Effect.catchDefect(flow(toSubscriptionPlanSyncIoError, Effect.fail))
);
