import { Schema } from "effect";
/**
 * Subscription recurring interval validator.
 * Nullable because some subscriptions (one-time purchases) don't have intervals.
 */
export const subscriptionRecurringIntervalValidator = Schema.NullOr(
  Schema.Literals(["day", "week", "month", "year"])
);
export type SubscriptionRecurringInterval = Schema.Schema.Type<
  typeof subscriptionRecurringIntervalValidator
>;
