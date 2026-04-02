import { userPlanValidator } from "@repo/backend/convex/users/schema";
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

export const creditResetPeriodValidator = v.object({
  plan: userPlanValidator,
  resetAt: v.number(),
});

const tables = {
  creditTransactions: defineTable(creditTransactionValidator),

  creditResetPeriods: defineTable(creditResetPeriodValidator).index("by_plan", [
    "plan",
  ]),
};

export default tables;
