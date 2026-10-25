import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type usersTable from "@repo/backend/confect/_generated/tables/users";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import {
  PlanSyncIoError,
  planSyncIoFailedCode,
} from "@repo/backend/confect/billing/spec";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { forfeitLots } from "@repo/backend/confect/credits/lots";
import { resolveCurrentCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import { Effect, flow, Schema } from "effect";

type UserDoc = typeof usersTable.Doc.Type;

/** Maps thrown Convex IO failures into the plan sync error channel. */
function toPlanSyncIoError(error: unknown) {
  return new PlanSyncIoError({
    code: planSyncIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/**
 * The grant a plan change came from. `expired` stands for a user whose last Pro
 * grant ended, and `ended` marks the status that the analytics read as cancelled.
 */
const planSourceValidator = Schema.Struct({
  id: Schema.String,
  productId: Schema.String,
  status: Schema.Literals(["active", "ended"]),
});
export type PlanSource = typeof planSourceValidator.Type;

/** Applies one durable user plan update and the matching credit transaction. */
export const applyPlanChange = Effect.fn("billing.plan.apply")(
  function* (
    user: UserDoc,
    newPlan: UserPlan,
    now: number,
    source: PlanSource
  ) {
    const writer = yield* DatabaseWriter;
    const previousPlan = user.plan;
    const creditConfig = getPlanCreditConfig(newPlan);
    const nextResetTimestamp = yield* resolveCurrentCreditResetTimestamp(
      newPlan,
      now
    ).pipe(Effect.mapError(toPlanSyncIoError));
    const isUpgrade = newPlan === "pro";
    const planCreditGrantId = yield* writer
      .table("creditTransactions")
      .insert({
        userId: user._id,
        amount: creditConfig.amount,
        type: isUpgrade ? "purchase" : creditConfig.grantType,
        balanceAfter: creditConfig.amount,
        metadata: {
          reason: isUpgrade ? "plan-upgrade" : "plan-downgrade",
          "previous-plan": previousPlan,
          "new-plan": newPlan,
          "grant-id": source.id,
        },
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("users")
      .patch(user._id, {
        plan: newPlan,
        credits: creditConfig.amount,
        creditsResetAt: nextResetTimestamp,
        planCreditGrantId,
      })
      .pipe(Effect.orDie);
    // Top-up packs run only while Pro does, so leaving Pro ends them at once.
    if (newPlan === "free") {
      yield* forfeitLots(user._id);
    }
    yield* Effect.logInfo("User plan changed with credits").pipe(
      Effect.annotateLogs({
        userId: user._id,
        grantId: source.id,
        creditsGranted: creditConfig.amount,
        previousPlan,
        newPlan,
      })
    );
    if (isUpgrade) {
      yield* captureProductEvent({
        distinctId: user._id,
        event: {
          name: "subscription started",
          properties: {
            product_id: source.productId,
            status: source.status,
          },
        },
        timestamp: now,
      });
    } else if (source.status === "ended") {
      yield* captureProductEvent({
        distinctId: user._id,
        event: {
          name: "subscription canceled",
          properties: {
            product_id: source.productId,
            status: source.status,
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
  Effect.catchDefect(flow(toPlanSyncIoError, Effect.fail))
);
