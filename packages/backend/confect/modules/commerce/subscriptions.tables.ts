import { Table } from "@confect/server";
import { polarMetadataSchema } from "@repo/backend/confect/modules/commerce/customers.tables";
import { Schema } from "effect";

/**
 * Subscription recurring interval validator.
 * Nullable because some subscriptions (one-time purchases) don't have intervals.
 */
export const subscriptionRecurringIntervalSchema = Schema.NullOr(
  Schema.Literal("day", "week", "month", "year")
);

export type SubscriptionRecurringInterval = Schema.Schema.Type<
  typeof subscriptionRecurringIntervalSchema
>;

/** subscriptions table definition. */
export const Subscriptions = Table.make(
  "subscriptions",
  Schema.Struct({
    id: Schema.String,
    customerId: Schema.String,
    schoolId: Schema.optional(Schema.String),
    createdAt: Schema.String,
    modifiedAt: Schema.NullOr(Schema.String),
    amount: Schema.NullOr(Schema.Number),
    currency: Schema.NullOr(Schema.String),
    recurringInterval: subscriptionRecurringIntervalSchema,
    status: Schema.String,
    currentPeriodStart: Schema.String,
    currentPeriodEnd: Schema.NullOr(Schema.String),
    cancelAtPeriodEnd: Schema.Boolean,
    startedAt: Schema.NullOr(Schema.String),
    endedAt: Schema.NullOr(Schema.String),
    productId: Schema.String,
    priceId: Schema.optional(Schema.String),
    checkoutId: Schema.NullOr(Schema.String),
    metadata: polarMetadataSchema,
    customerCancellationReason: Schema.optional(Schema.NullOr(Schema.String)),
    customerCancellationComment: Schema.optional(Schema.NullOr(Schema.String)),
  })
)
  .index("by_subscriptionId", ["id"])
  .index("by_customerId_and_status", ["customerId", "status"])
  .index("by_customerId_and_status_and_productId", [
    "customerId",
    "status",
    "productId",
  ])
  .index("by_customerId_and_status_and_productId_and_currentPeriodEnd", [
    "customerId",
    "status",
    "productId",
    "currentPeriodEnd",
  ]);

export const tables = [Subscriptions] as const;
