import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { UserPlan } from "@repo/backend/convex/users/schema";

/**
 * Grant types for credit reset (subset of CreditTransactionType).
 */
type CreditGrantType = "daily-grant" | "monthly-grant";

/**
 * Credit grant configuration per plan.
 * Extensible for future plans: max, ultra, enterprise, etc.
 */
export const PLAN_CREDIT_CONFIG: Record<
  UserPlan,
  {
    /** Amount of credits granted per reset cycle */
    amount: number;
    /** Grant type for transaction logging */
    grantType: CreditGrantType;
  }
> = {
  free: {
    amount: 10,
    grantType: "daily-grant",
  },
  pro: {
    amount: 3000,
    grantType: "monthly-grant",
  },
};

/**
 * Get credit configuration for a plan.
 * Type-safe - TypeScript ensures all UserPlan values have config.
 */
export function getPlanCreditConfig(plan: UserPlan) {
  return PLAN_CREDIT_CONFIG[plan];
}

/**
 * Default plan for new users.
 */
export const DEFAULT_USER_PLAN: UserPlan = "free";

/**
 * Default credits for new users (uses free plan config).
 */
export const DEFAULT_USER_CREDITS =
  PLAN_CREDIT_CONFIG[DEFAULT_USER_PLAN].amount;

/** Returns the current UTC reset boundary for a plan. */
export function getCurrentCreditResetTimestamp(
  plan: UserPlan,
  now = Date.now()
) {
  const resetDate = new Date(now);

  if (plan === "free") {
    resetDate.setUTCHours(0, 0, 0, 0);
    return resetDate.getTime();
  }

  resetDate.setUTCDate(1);
  resetDate.setUTCHours(0, 0, 0, 0);
  return resetDate.getTime();
}

/** Normalizes one user's stored credit state into the current reset period. */
export function getEffectiveCreditState(
  user: Pick<Doc<"users">, "credits" | "creditsResetAt" | "plan">,
  now = Date.now()
) {
  const resetTimestamp = getCurrentCreditResetTimestamp(user.plan, now);

  if (user.creditsResetAt >= resetTimestamp) {
    return {
      credits: user.credits,
      creditsResetAt: user.creditsResetAt,
    };
  }

  return {
    credits:
      PLAN_CREDIT_CONFIG[user.plan].amount +
      (user.credits < 0 ? user.credits : 0),
    creditsResetAt: resetTimestamp,
  };
}
