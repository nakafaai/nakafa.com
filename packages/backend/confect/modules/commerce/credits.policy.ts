import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import type { UserPlan } from "@repo/backend/confect/modules/identity/users.tables";

type UserDoc = Doc<"users">;

export const PLAN_CREDIT_CONFIG = {
  free: {
    amount: 10,
    grantType: "daily-grant",
  },
  pro: {
    amount: 3000,
    grantType: "monthly-grant",
  },
} as const;

export const DEFAULT_USER_PLAN = "free";
export const DEFAULT_USER_CREDITS =
  PLAN_CREDIT_CONFIG[DEFAULT_USER_PLAN].amount;

/** Returns credit reset policy for a user plan. */
export function getPlanCreditConfig(plan: UserPlan) {
  return PLAN_CREDIT_CONFIG[plan];
}

/** Returns the current credit reset timestamp for a user plan. */
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

/** Returns the effective credit state after applying the current reset period. */
export function getEffectiveCreditStateForResetTimestamp(
  user: UserDoc,
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

/** Returns the credit transaction created by a reset, when a reset happened. */
export function getCreditResetGrantTransaction(
  user: UserDoc,
  effectiveState: ReturnType<typeof getEffectiveCreditStateForResetTimestamp>
) {
  if (effectiveState.creditsResetAt === user.creditsResetAt) {
    return null;
  }

  const planCreditConfig = getPlanCreditConfig(user.plan);

  return {
    amount: planCreditConfig.amount,
    balanceAfter: effectiveState.credits,
    metadata: {
      "previous-balance": user.credits,
      "previous-reset-at": user.creditsResetAt,
      "reset-at": effectiveState.creditsResetAt,
    },
    type: planCreditConfig.grantType,
  };
}
