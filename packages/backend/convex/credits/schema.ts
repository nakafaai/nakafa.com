import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

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

export const creditTransactionValidator = v.object({
  userId: v.id("users"),
  amount: v.number(),
  type: creditTransactionTypeValidator,
  balanceAfter: v.number(),
  metadata: v.optional(v.record(v.string(), v.any())),
});

export const creditResetQueueValidator = v.object({
  userId: v.id("users"),
  plan: literals("free", "pro"),
  resetTimestamp: v.number(),
  status: literals("pending", "processing", "completed", "failed"),
  processedAt: v.optional(v.number()),
  error: v.optional(v.string()),
});

export const creditResetJobTypeValidator = literals(
  "free-daily",
  "pro-monthly"
);

export type CreditResetJobType = Infer<typeof creditResetJobTypeValidator>;

export const creditResetJobValidator = v.object({
  jobType: creditResetJobTypeValidator,
  status: literals("pending", "running", "completed", "failed"),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  resetTimestamp: v.number(),
  totalUsers: v.number(),
  processedUsers: v.number(),
  error: v.optional(v.string()),
});

const tables = {
  creditTransactions: defineTable(creditTransactionValidator),

  creditResetQueue: defineTable(creditResetQueueValidator)
    .index("by_status", ["status"])
    .index("by_plan_and_status_and_resetTimestamp", [
      "plan",
      "status",
      "resetTimestamp",
    ]),

  creditResetJobs: defineTable(creditResetJobValidator),
};

export default tables;
