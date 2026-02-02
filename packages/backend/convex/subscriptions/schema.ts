import { polarMetadataValidator } from "@repo/backend/convex/lib/contentValidators";
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
    id: v.string(),
    customerId: v.string(),
    schoolId: v.optional(v.id("schools")),
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
    .index("id", ["id"])
    .index("customerId_status", ["customerId", "status"])
    .index("schoolId_status", ["schoolId", "status"]),
};

export default tables;
