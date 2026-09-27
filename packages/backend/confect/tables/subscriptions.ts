import { Table } from "@confect/core";
import { polarMetadataValidator } from "@repo/backend/confect/customers/schema";
import { subscriptionRecurringIntervalValidator } from "@repo/backend/confect/subscriptions/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** Polar subscription ID persisted for webhook upserts. */
    id: Schema.String,
    /** Polar customer ID linked to the subscription. */
    customerId: Schema.String,
    schoolId: Schema.optionalKey(Schema.String),
    createdAt: Schema.String,
    modifiedAt: Schema.NullOr(Schema.String),
    amount: Schema.NullOr(Schema.Finite),
    currency: Schema.NullOr(Schema.String),
    recurringInterval: subscriptionRecurringIntervalValidator,
    status: Schema.String,
    currentPeriodStart: Schema.String,
    currentPeriodEnd: Schema.NullOr(Schema.String),
    cancelAtPeriodEnd: Schema.Boolean,
    startedAt: Schema.NullOr(Schema.String),
    endedAt: Schema.NullOr(Schema.String),
    productId: Schema.String,
    priceId: Schema.optionalKey(Schema.String),
    checkoutId: Schema.NullOr(Schema.String),
    metadata: polarMetadataValidator,
    customerCancellationReason: Schema.optionalKey(
      Schema.NullOr(Schema.String)
    ),
    customerCancellationComment: Schema.optionalKey(
      Schema.NullOr(Schema.String)
    ),
  })
)
  .index("by_subscriptionId", ["id"])
  .index("by_status", ["status"])
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
