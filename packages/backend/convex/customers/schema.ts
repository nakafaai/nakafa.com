import { defineTable } from "convex/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Polar metadata validator.
 * Polar stores flat primitive metadata values.
 */
export const polarMetadataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean())
);

const tables = {
  customers: defineTable({
    /** Polar customer ID persisted for webhook and checkout lookups. */
    id: v.string(),
    externalId: nullable(v.string()),
    userId: v.id("users"),
    metadata: v.optional(polarMetadataValidator),
  })
    .index("by_userId", ["userId"])
    .index("by_polarId", ["id"]),
  customerDeletionTombstones: defineTable({
    /**
     * Polar customer deletion is terminal for this ID. Retaining the ID keeps
     * delayed or replayed webhooks from recreating billing state.
     */
    polarCustomerId: v.string(),
    /**
     * Present only while the deleted-user billing workflow still needs the
     * Polar ID as a durable retry checkpoint.
     */
    cleanupUserId: v.optional(v.id("users")),
  })
    .index("by_polarCustomerId", ["polarCustomerId"])
    .index("by_cleanupUserId", ["cleanupUserId"]),
};

export default tables;
