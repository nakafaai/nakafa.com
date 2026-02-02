import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Polar metadata validator.
 * Uses v.any() because Polar's SDK defines the metadata structure externally.
 * We sync this from Polar webhooks and cannot control their schema changes.
 */
const polarMetadataValidator = v.optional(v.record(v.string(), v.any()));

const tables = {
  customers: defineTable({
    id: v.string(), // Polar customer ID
    externalId: v.union(v.null(), v.string()), // Better Auth user ID
    userId: v.id("users"), // Local app user ID (1 user = 1 customer)
    metadata: polarMetadataValidator,
  })
    .index("userId", ["userId"]) // Query by app user ID
    .index("id", ["id"]) // Query by Polar customer ID
    .index("externalId", ["externalId"]), // Query by Better Auth user ID
};

export default tables;
