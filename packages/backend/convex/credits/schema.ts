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

/** Scalar audit values allowed on credit transaction metadata. */
export const creditTransactionMetadataValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null()
);

/** Bounded metadata record for credit audit events. */
export const creditTransactionMetadataValidator = v.record(
  v.string(),
  creditTransactionMetadataValueValidator
);

export type CreditTransactionMetadata = Infer<
  typeof creditTransactionMetadataValidator
>;

export const creditTransactionValidator = v.object({
  userId: v.id("users"),
  amount: v.number(),
  type: creditTransactionTypeValidator,
  balanceAfter: v.number(),
  metadata: v.optional(creditTransactionMetadataValidator),
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
