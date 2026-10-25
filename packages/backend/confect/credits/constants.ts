/**
 * Credit grant configuration per plan.
 * Extensible for future plans: max, ultra, enterprise, etc.
 */
import type { planCreditValidator } from "@repo/backend/confect/credits/schema";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import { Array as Arr, Result, Schema } from "effect";

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
 * Credits a typical Nina answer costs. The web reads it to show how many answers
 * a plan gives. The ledger charges each answer its real model cost instead
 * (`creditsCharged`), so this figure is an estimate and never a charge.
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

/** The same unit in micro-dollars, so credit arithmetic stays in whole numbers. */
const CREDIT_UNIT_MICRO_USD = Math.round(CREDIT_UNIT_USD * 1_000_000);

/** The most credits one answer may hold, so an answer never costs more than this in models. */
export const MAX_CREDITS_PER_RESPONSE = 50;

/** Credits one answer costs for its reported model cost: rounded up, at least one, at most the cap. */
export function creditsForCost(costUsd: number): number {
  const credits = Math.ceil(
    Math.round(costUsd * 1_000_000) / CREDIT_UNIT_MICRO_USD
  );
  return Math.min(MAX_CREDITS_PER_RESPONSE, Math.max(1, credits));
}

/** The cost a model call reported, when its gateway reported one. */
const UsageCost = Schema.Struct({ cost: Schema.optionalKey(Schema.Finite) });

/**
 * The credits a finished answer costs, out of the `hold` it reserved: the cost
 * its model calls reported, priced by `creditsForCost`, and never more than the
 * hold. A call that reports no cost charges the whole hold, because an unpriced
 * call cannot be shown to cost less, so Nakafa never sells it below its cost.
 */
export function creditsCharged(
  usage: readonly (typeof UsageCost.Type)[],
  hold: number
): number {
  const costs = Arr.filterMap(usage, (row) =>
    row.cost === undefined ? Result.failVoid : Result.succeed(row.cost)
  );
  if (costs.length < usage.length) {
    return hold;
  }
  const cost = Arr.reduce(costs, 0, (total, value) => total + value);
  return Math.min(hold, creditsForCost(cost));
}

/** The shared daily budget of free answers: 5% of last month's net product revenue, divided by 30, in credits. */
const FREE_BUDGET_SHARE = 0.05;

/** Free credits shared by every free account on one day, from last month's net product revenue in dollars. */
export function freeDailyBudgetCredits(lastMonthNetRevenueUsd: number): number {
  return Math.floor(
    (FREE_BUDGET_SHARE * lastMonthNetRevenueUsd) / 30 / CREDIT_UNIT_USD
  );
}

/** Credits one top-up pack grants, bought as one Polar order. */
export const TOP_UP_PACK_CREDITS = 1000;

/** Months a top-up pack's credits last from the payment that bought them. */
export const TOP_UP_VALIDITY_MONTHS = 12;

/** The most top-up packs one read takes, soonest expiring first, so every read stays bounded. */
export const MAX_CREDIT_LOTS = 100;
