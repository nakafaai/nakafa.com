import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import {
  XenditDeactivateError,
  xenditDeactivateErrorCode,
} from "@repo/backend/confect/billing/spec";
import { ensurePlanInactive } from "@repo/backend/confect/billing/xendit/plans";
import { Duration, Effect, Option, Schedule } from "effect";

/** The statuses of a Xendit Pro plan the learner can still cancel. */
const CANCELABLE_STATUSES = ["active", "pastDue"] as const;

/** How often Xendit is asked again to turn a canceled plan off before the failure is logged for an operator. */
const DEACTIVATE_RETRIES = 4;

/**
 * Cancels the learner's Xendit Pro plan at the end of its paid period: the plan
 * shows as ending at once, and Xendit is asked to turn it off, so no further
 * cycle is charged. Pro runs on until the paid period ends. A learner with no
 * such plan, or one already ending, changes nothing.
 */
export const cancelXenditPlan = Effect.fn("billing.xendit.cancel")(function* (
  userId: Docs["users"]["_id"]
) {
  const account = yield* findAccount({ kind: "personal", userId }, "xendit");
  if (Option.isNone(account)) {
    return null;
  }
  const reader = yield* DatabaseReader;
  for (const status of CANCELABLE_STATUSES) {
    const subscription = yield* reader
      .table("billingSubscriptions")
      .index("by_accountId_and_status", (query) =>
        query.eq("accountId", account.value._id).eq("status", status)
      )
      .first()
      .pipe(Effect.orDie);
    if (
      Option.isNone(subscription) ||
      subscription.value.provider.kind !== "xendit" ||
      billingOffer(subscription.value.offer).product !== "pro" ||
      subscription.value.cancelAtPeriodEnd
    ) {
      continue;
    }
    yield* (yield* DatabaseWriter)
      .table("billingSubscriptions")
      .patch(subscription.value._id, { cancelAtPeriodEnd: true })
      .pipe(Effect.orDie);
    // A plan that has not opened yet never opens for a canceled subscription, so only an open plan is turned off.
    const planId = subscription.value.provider.planId;
    if (planId !== null) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.billing.xendit.cancel.deactivate,
        { planId }
      );
    }
    return null;
  }
  return null;
});

/**
 * Turns a canceled plan off at Xendit, asking again with a growing pause when
 * Xendit fails. A plan that stays on is logged for an operator, since Xendit
 * would charge its next cycle.
 */
export const deactivateCanceledPlan = Effect.fn(
  "billing.xendit.deactivateCanceled"
)(function* (planId: string) {
  return yield* ensurePlanInactive(planId).pipe(
    Effect.scoped,
    Effect.retry({
      schedule: Schedule.exponential(Duration.seconds(2)),
      times: DEACTIVATE_RETRIES,
    }),
    Effect.tapError((cause) =>
      Effect.logError("A canceled Xendit plan is still on", { cause, planId })
    ),
    Effect.mapError(
      (cause) =>
        new XenditDeactivateError({
          code: xenditDeactivateErrorCode,
          cause,
          message: "Failed to turn off a Xendit recurring plan.",
        })
    )
  );
});
