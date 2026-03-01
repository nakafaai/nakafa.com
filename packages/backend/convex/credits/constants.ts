import type { UserPlan } from "@repo/backend/convex/users/schema";

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
    grantType: "daily-grant" | "monthly-grant";
    /** Job type identifier for credit reset jobs */
    jobType: "free-daily" | "pro-monthly";
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
 * Note: Convex workflows don't support setTimeout or Date.now(),
 * so we use a fixed number of workers instead of dynamic scaling.
 */
export const RESET_WORKFLOW_CONFIG = {
  maxWorkers: 10,
  progressReportInterval: 10,
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
