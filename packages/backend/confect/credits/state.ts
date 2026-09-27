import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import { Effect } from "effect";

type CreditStateUser = Pick<UsersDoc, "credits" | "creditsResetAt" | "plan">;
type EffectiveCreditState = ReturnType<
  typeof getEffectiveCreditStateForResetTimestamp
>;

/** Returns the current UTC reset boundary for a plan. */
export function getCurrentCreditResetTimestamp(plan: UserPlan, now: number) {
  const resetDate = new Date(now);
  if (plan === "free") {
    resetDate.setUTCHours(0, 0, 0, 0);
    return resetDate.getTime();
  }
  resetDate.setUTCDate(1);
  resetDate.setUTCHours(0, 0, 0, 0);
  return resetDate.getTime();
}

/** Applies one materialized reset boundary to a stored user credit state. */
export function getEffectiveCreditStateForResetTimestamp(
  user: CreditStateUser,
  resetTimestamp: number
) {
  if (user.creditsResetAt >= resetTimestamp) {
    return {
      credits: user.credits,
      creditsResetAt: user.creditsResetAt,
    };
  }
  return {
    credits:
      getPlanCreditConfig(user.plan).amount +
      (user.credits < 0 ? user.credits : 0),
    creditsResetAt: resetTimestamp,
  };
}

/**
 * Returns the grant transaction needed when a user crosses into a newer reset
 * window, or null when no reset happened.
 */
export function getCreditResetGrantTransaction(
  user: CreditStateUser,
  effectiveState: EffectiveCreditState
) {
  if (effectiveState.creditsResetAt === user.creditsResetAt) {
    return null;
  }
  const planCreditConfig = getPlanCreditConfig(user.plan);
  return {
    amount: planCreditConfig.amount,
    type: planCreditConfig.grantType,
    balanceAfter: effectiveState.credits,
    metadata: {
      "previous-balance": user.credits,
      "previous-reset-at": user.creditsResetAt,
      "reset-at": effectiveState.creditsResetAt,
    },
  };
}

/** Normalize storage failures at the credit ledger boundary. */
function creditStateFailure() {
  return new CreditStateError({
    code: "CREDIT_STATE_FAILED",
    message: "Unable to read or update the credit reset period.",
  });
}

/** The plan index must own at most one materialized reset boundary. */
const readPeriod = Effect.fn("credits.readPeriod")(
  function* (plan: UserPlan) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("creditResetPeriods")
      .get("by_plan", plan)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(creditStateFailure)
      );
  },
  Effect.catchDefect(() => creditStateFailure())
);

/** Loads the stored current reset boundary for a plan. */
export const getStoredCreditResetTimestamp = Effect.fn(
  "credits.storedBoundary"
)(function* (plan: UserPlan) {
  const period = yield* readPeriod(plan);
  return period?.resetAt ?? null;
});

/** Resolves the current reset boundary for write paths. */
export const resolveCurrentCreditResetTimestamp = Effect.fn(
  "credits.currentBoundary"
)(function* (plan: UserPlan, now: number) {
  const currentResetTimestamp = getCurrentCreditResetTimestamp(plan, now);
  const storedResetTimestamp = yield* getStoredCreditResetTimestamp(plan);
  if (
    storedResetTimestamp !== null &&
    storedResetTimestamp >= currentResetTimestamp
  ) {
    return storedResetTimestamp;
  }
  yield* upsertStoredCreditResetTimestamp(plan, currentResetTimestamp);
  return currentResetTimestamp;
});

/** Resolves one user's effective credit state for the current reset period. */
export const resolveEffectiveCreditState = Effect.fn("credits.effectiveState")(
  function* (user: CreditStateUser, now: number) {
    const resetTimestamp = yield* resolveCurrentCreditResetTimestamp(
      user.plan,
      now
    );
    return getEffectiveCreditStateForResetTimestamp(user, resetTimestamp);
  }
);

/** Upserts one materialized reset boundary in the current transaction. */
export const upsertStoredCreditResetTimestamp = Effect.fn(
  "credits.writeBoundary"
)(
  function* (plan: UserPlan, resetAt: number) {
    const existing = yield* readPeriod(plan);
    const writer = yield* DatabaseWriter;
    const periods = writer.table("creditResetPeriods");
    if (!existing) {
      yield* periods
        .insert({
          plan,
          resetAt,
        })
        .pipe(Effect.mapError(creditStateFailure));
      return null;
    }
    if (existing.resetAt === resetAt) {
      return null;
    }
    yield* periods
      .patch(existing._id, {
        resetAt,
      })
      .pipe(Effect.mapError(creditStateFailure));
    return null;
  },
  Effect.catchDefect(() => creditStateFailure())
);
