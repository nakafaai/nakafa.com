import { nullable } from "@repo/backend/convex/lib/validators";
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
    id: v.string(),
    externalId: nullable(v.string()),
    userId: v.id("users"),
    metadata: polarMetadataValidator,
  })
    .index("userId", ["userId"])
    .index("id", ["id"])
    .index("externalId", ["externalId"]),
};

export default tables;
