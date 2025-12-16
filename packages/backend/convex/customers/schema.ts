import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  customers: defineTable({
    id: v.string(), // Polar customer ID
    externalId: v.union(v.null(), v.string()), // Better Auth user ID
    userId: v.id("users"), // Local app user ID (1 user = 1 customer)
    metadata: v.optional(v.record(v.string(), v.any())), // Polar metadata (synced from Polar)
  })
    .index("userId", ["userId"]) // Query by app user ID
    .index("id", ["id"]) // Query by Polar customer ID
    .index("externalId", ["externalId"]), // Query by Better Auth user ID
};

export default tables;
