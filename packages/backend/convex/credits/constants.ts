import type { CreditResetJobType } from "@repo/backend/convex/credits/schema";
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
    /** Job type identifier for credit reset jobs */
    jobType: CreditResetJobType;
  }
> = {
  free: {
    amount: 10,
    grantType: "daily-grant",
    jobType: "free-daily",
  },
  pro: {
    amount: 3000,
    grantType: "monthly-grant",
    jobType: "pro-monthly",
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

/**
 * Workflow configuration for credit reset processing.
 * Queue writes and queue claims use the same partition count so each worker
 * owns one disjoint queue slice.
 */
export const RESET_WORKFLOW_CONFIG = {
  partitionCount: 10,
  populateBatchSize: 1000,
  processBatchSize: 100,
} as const;

/**
 * Cleanup configuration for old queue items.
 */
export const CLEANUP_CONFIG = {
  retentionDays: 7,
  batchSize: 1000,
} as const;
