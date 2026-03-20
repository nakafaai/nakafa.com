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
    id: v.string(),
    externalId: nullable(v.string()),
    userId: v.id("users"),
    metadata: v.optional(polarMetadataValidator),
  })
    .index("userId", ["userId"])
    .index("id", ["id"]),
};

export default tables;
