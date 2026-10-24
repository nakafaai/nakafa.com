/**
 * Credit grant configuration per plan.
 * Extensible for future plans: max, ultra, enterprise, etc.
 */
import type { planCreditValidator } from "@repo/backend/confect/credits/schema";
import type { UserPlan } from "@repo/backend/confect/users/schema";

/**
 * Credit grant configuration per plan.
 * Extensible for future plans: max, ultra, enterprise, etc.
 */
const PLAN_CREDIT_CONFIG: Record<UserPlan, typeof planCreditValidator.Type> = {
  free: {
    amount: 10,
    grantType: "daily-grant",
  },
  pro: {
    amount: 1000,
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
 * Credits one Nina response holds and charges. The web reads it to show how
 * many answers a plan gives, so it lives beside the plan grants.
 */
export const NINA_RESPONSE_CREDITS = 5;

/**
 * Default plan for new users.
 */
export const DEFAULT_USER_PLAN: UserPlan = "free";

/**
 * Default credits for new users (uses free plan config).
 */
export const DEFAULT_USER_CREDITS =
  PLAN_CREDIT_CONFIG[DEFAULT_USER_PLAN].amount;

/** The dollar value of one credit: the model cost the gateway reports, divided into 2,000 parts. */
const CREDIT_UNIT_USD = 0.002;

/** The most credits one answer may hold, so an answer never costs more than this in models. */
const MAX_CREDITS_PER_RESPONSE = 50;

/** Credits one answer costs for its reported model cost: rounded up, at least one, at most the cap. */
export function creditsForCost(costUsd: number): number {
  const credits = Math.ceil(costUsd / CREDIT_UNIT_USD);
  return Math.min(MAX_CREDITS_PER_RESPONSE, Math.max(1, credits));
}

/** The shared daily budget of free answers: 5% of last month's net product revenue, divided by 30, in credits. */
const FREE_BUDGET_SHARE = 0.05;

/** Free credits shared by every free account on one day, from last month's net product revenue in dollars. */
export function freeDailyBudgetCredits(lastMonthNetRevenueUsd: number): number {
  return Math.floor(
    (FREE_BUDGET_SHARE * lastMonthNetRevenueUsd) / 30 / CREDIT_UNIT_USD
  );
}
