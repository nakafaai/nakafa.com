import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Credit transaction types
 */
export const creditTransactionTypeValidator = literals(
  "daily-grant",
  "monthly-grant",
  "usage",
  "purchase",
  "refund",
  "bonus",
  "expiration"
);

export type CreditTransactionType = Infer<
  typeof creditTransactionTypeValidator
>;

/**
 * Credit transactions table - Audit trail for all credit changes
 * Uses Convex's built-in _creationTime instead of createdAt
 */
export const creditTransactionValidator = v.object({
  userId: v.id("users"),
  amount: v.number(),
  type: creditTransactionTypeValidator,
  balanceAfter: v.number(),
  metadata: v.optional(v.record(v.string(), v.any())),
});

/**
 * Credit reset job tracking - Monitor reset progress
 * Uses Convex's built-in _creationTime instead of createdAt
 */
export const creditResetJobValidator = v.object({
  jobType: literals("free-daily", "pro-monthly"),
  status: literals("pending", "running", "completed", "failed"),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  resetTimestamp: v.number(),
  totalUsers: v.optional(v.number()),
  processedUsers: v.number(),
  error: v.optional(v.string()),
});

const tables = {
  creditTransactions: defineTable(creditTransactionValidator)
    .index("userId", ["userId"])
    .index("type", ["type"]),

  creditResetJobs: defineTable(creditResetJobValidator)
    .index("jobTypeStartedAt", ["jobType", "startedAt"])
    .index("status", ["status"]),
};

export default tables;
