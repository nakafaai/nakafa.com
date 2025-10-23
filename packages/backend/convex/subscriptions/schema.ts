import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  subscriptions: defineTable({
    id: v.string(),
    customerId: v.string(),
    createdAt: v.string(),
    modifiedAt: v.union(v.string(), v.null()),
    amount: v.union(v.number(), v.null()),
    currency: v.union(v.string(), v.null()),
    recurringInterval: v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year"),
      v.null()
    ),
    status: v.string(),
    currentPeriodStart: v.string(),
    currentPeriodEnd: v.union(v.string(), v.null()),
    cancelAtPeriodEnd: v.boolean(),
    startedAt: v.union(v.string(), v.null()),
    endedAt: v.union(v.string(), v.null()),
    productId: v.string(),
    priceId: v.optional(v.string()),
    checkoutId: v.union(v.string(), v.null()),
    metadata: v.record(v.string(), v.any()),
    customerCancellationReason: v.optional(v.union(v.string(), v.null())),
    customerCancellationComment: v.optional(v.union(v.string(), v.null())),
  })
    .index("id", ["id"])
    .index("customerId", ["customerId"])
    .index("customerId_status", ["customerId", "status"])
    .index("customerId_endedAt", ["customerId", "endedAt"]),
};

export default tables;
