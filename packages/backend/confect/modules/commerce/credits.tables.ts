import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { userPlanSchema } from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

export const creditTransactionTypeSchema = Schema.Literal(
  "daily-grant",
  "monthly-grant",
  "usage",
  "purchase",
  "refund",
  "bonus",
  "expiration"
);

export type CreditTransactionType = Schema.Schema.Type<
  typeof creditTransactionTypeSchema
>;

const creditMetadataValueSchema = Schema.Union(
  Schema.Null,
  Schema.Boolean,
  Schema.Number,
  Schema.String
);

const creditMetadataSchema = Schema.Record({
  key: Schema.String,
  value: creditMetadataValueSchema,
});

export const creditTransactionSchema = Schema.Struct({
  userId: GenericId.GenericId("users"),
  amount: Schema.Number,
  type: creditTransactionTypeSchema,
  balanceAfter: Schema.Number,
  metadata: Schema.optional(creditMetadataSchema),
});

export const creditResetPeriodSchema = Schema.Struct({
  plan: userPlanSchema,
  resetAt: Schema.Number,
});

/** creditTransactions table definition. */
export const CreditTransactions = Table.make(
  "creditTransactions",
  creditTransactionSchema
);

/** creditResetPeriods table definition. */
export const CreditResetPeriods = Table.make(
  "creditResetPeriods",
  creditResetPeriodSchema
).index("by_plan", ["plan"]);

export const tables = [CreditTransactions, CreditResetPeriods] as const;
