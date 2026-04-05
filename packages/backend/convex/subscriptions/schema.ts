import { polarMetadataValidator } from "@repo/backend/convex/customers/schema";
import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

/**
 * Subscription recurring interval validator.
 * Nullable because some subscriptions (one-time purchases) don't have intervals.
 */
export const subscriptionRecurringIntervalValidator = nullable(
  literals("day", "week", "month", "year")
);
export type SubscriptionRecurringInterval = Infer<
  typeof subscriptionRecurringIntervalValidator
>;

const tables = {
  subscriptions: defineTable({
    /** Polar subscription ID persisted for webhook upserts. */
    id: v.string(),
    /** Polar customer ID linked to the subscription. */
    customerId: v.string(),
    schoolId: v.optional(v.string()),
    createdAt: v.string(),
    modifiedAt: nullable(v.string()),
    amount: nullable(v.number()),
    currency: nullable(v.string()),
    recurringInterval: subscriptionRecurringIntervalValidator,
    status: v.string(),
    currentPeriodStart: v.string(),
    currentPeriodEnd: nullable(v.string()),
    cancelAtPeriodEnd: v.boolean(),
    startedAt: nullable(v.string()),
    endedAt: nullable(v.string()),
    productId: v.string(),
    priceId: v.optional(v.string()),
    checkoutId: nullable(v.string()),
    metadata: polarMetadataValidator,
    customerCancellationReason: v.optional(nullable(v.string())),
    customerCancellationComment: v.optional(nullable(v.string())),
  })
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
    ]),
};

export default tables;
