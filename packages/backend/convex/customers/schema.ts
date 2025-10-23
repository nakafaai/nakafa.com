import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  customers: defineTable({
    id: v.string(),
    externalId: v.union(v.null(), v.string()),
    userId: v.id("users"),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index("userId", ["userId"])
    .index("id", ["id"])
    .index("externalId", ["externalId"]),
};

export default tables;
