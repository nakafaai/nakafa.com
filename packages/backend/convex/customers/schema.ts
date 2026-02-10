import { defineTable } from "convex/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Polar metadata validator.
 * Uses v.any() because Polar's SDK defines the metadata structure externally.
 * We sync this from Polar webhooks and cannot control their schema changes.
 */
export const polarMetadataValidator = v.record(v.string(), v.any());

const tables = {
  customers: defineTable({
    id: v.string(),
    externalId: nullable(v.string()),
    userId: v.id("users"),
    metadata: v.optional(polarMetadataValidator),
  })
    .index("userId", ["userId"])
    .index("id", ["id"])
    .index("externalId", ["externalId"]),
};

export default tables;
