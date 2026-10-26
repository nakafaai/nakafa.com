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
export const creditTransactionMetadataValidator = Schema.Record(
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

/**
 * One top-up pack's credits. `remaining` is what the pack still holds, and
 * `state` says whether it still runs: an `active` lot is spent soonest-expiring
 * first, and every other state ends it, so `remaining` stays at zero from then.
 */
export const creditLotValidator = Schema.Struct({
  userId: IdSchema("users"),
  /** The top-up payment that bought the pack. */
  paymentId: IdSchema("billingPayments"),
  granted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  remaining: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  /** The moment the unused credits stop being usable, in epoch milliseconds. */
  expiresAt: Schema.Finite,
  state: Schema.Literals(["active", "expired", "forfeited", "refunded"]),
});

/** The credits one reservation took from one top-up pack. */
export const CreditLotDraw = Schema.Struct({
  lotId: IdSchema("creditLots"),
  credits: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});

/**
 * What a school's members drew from its shared Nina pool in one calendar month
 * (UTC), `YYYY-MM`. One row per school and month.
 */
export const creditPoolValidator = Schema.Struct({
  tenantId: IdSchema("tenants"),
  month: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/u)),
  used: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** What one member drew from their school's pool on one day (UTC), `YYYY-MM-DD`, which the school's daily cap bounds. */
export const creditPoolDayValidator = Schema.Struct({
  tenantId: IdSchema("tenants"),
  userId: IdSchema("users"),
  day: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)),
  used: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** The pool one reservation drew from: the school, and the month and day it counted against. */
export const CreditPoolDraw = Schema.Struct({
  tenantId: IdSchema("tenants"),
  month: Schema.String,
  day: Schema.String,
});
