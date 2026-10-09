import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { userPlanValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";

const creditTransactionTypeValidator = Schema.Literals([
  "daily-grant",
  "monthly-grant",
  "usage",
  "purchase",
  "refund",
  "bonus",
  "expiration",
]);
const creditGrantTypeValidator = creditTransactionTypeValidator.pick([
  "daily-grant",
  "monthly-grant",
]);

/** Scalar audit values allowed on credit transaction metadata. */
const creditTransactionMetadataValueValidator = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]);

/** Bounded metadata record for credit audit events. */
const creditTransactionMetadataValidator = Schema.Record(
  Schema.String,
  creditTransactionMetadataValueValidator
);
export const creditTransactionValidator = Schema.Struct({
  userId: IdSchema("users"),
  amount: Schema.Finite,
  type: creditTransactionTypeValidator,
  balanceAfter: Schema.Finite,
  metadata: Schema.optionalKey(creditTransactionMetadataValidator),
});
export const creditResetPeriodValidator = Schema.Struct({
  plan: userPlanValidator,
  resetAt: Schema.Finite,
});
export const planCreditValidator = Schema.Struct({
  /** Amount of credits granted per reset cycle */
  amount: Schema.Finite,
  /** Grant type for transaction logging */
  grantType: creditGrantTypeValidator,
});
