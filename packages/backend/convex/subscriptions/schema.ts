import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

const SubscriptionRecurringInterval = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
  v.literal("year"),
  v.null()
);
export type SubscriptionRecurringInterval = Infer<
  typeof SubscriptionRecurringInterval
>;

/**
 * Polar metadata validator.
 * Uses v.any() because Polar's SDK defines the metadata structure externally.
 * We sync this from Polar webhooks and cannot control their schema changes.
 */
const polarMetadataValidator = v.record(v.string(), v.any());

const tables = {
  subscriptions: defineTable({
    id: v.string(),
    customerId: v.string(),
    schoolId: v.optional(v.id("schools")), // For school subscriptions only (null = personal subscription)
    createdAt: v.string(),
    modifiedAt: v.union(v.string(), v.null()),
    amount: v.union(v.number(), v.null()),
    currency: v.union(v.string(), v.null()),
    recurringInterval: SubscriptionRecurringInterval,
    status: v.string(),
    currentPeriodStart: v.string(),
    currentPeriodEnd: v.union(v.string(), v.null()),
    cancelAtPeriodEnd: v.boolean(),
    startedAt: v.union(v.string(), v.null()),
    endedAt: v.union(v.string(), v.null()),
    productId: v.string(),
    priceId: v.optional(v.string()),
    checkoutId: v.union(v.string(), v.null()),
    metadata: polarMetadataValidator,
    customerCancellationReason: v.optional(v.union(v.string(), v.null())),
    customerCancellationComment: v.optional(v.union(v.string(), v.null())),
  })
    .index("id", ["id"]) // Lookup by Polar subscription ID (webhooks)
    .index("customerId_status", ["customerId", "status"]) // Query by customer (omit status for all)
    .index("schoolId_status", ["schoolId", "status"]), // Query by school (omit status for all)
};

export default tables;
