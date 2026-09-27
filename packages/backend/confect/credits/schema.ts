import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { userPlanValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";
export const creditTransactionTypeValidator = Schema.Literals([
  "daily-grant",
  "monthly-grant",
  "usage",
  "purchase",
  "refund",
  "bonus",
  "expiration",
]);
export type CreditTransactionType = Schema.Schema.Type<
  typeof creditTransactionTypeValidator
>;
export type CreditGrantType = Extract<CreditTransactionType, `${string}-grant`>;

/** Scalar audit values allowed on credit transaction metadata. */
export const creditTransactionMetadataValueValidator = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]);

/** Bounded metadata record for credit audit events. */
export const creditTransactionMetadataValidator = Schema.Record(
  Schema.String,
  creditTransactionMetadataValueValidator
);
export type CreditTransactionMetadata = Schema.Schema.Type<
  typeof creditTransactionMetadataValidator
>;
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
