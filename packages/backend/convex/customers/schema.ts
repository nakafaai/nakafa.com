import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  customers: defineTable({
    id: v.string(), // Polar customer ID
    externalId: v.union(v.null(), v.string()), // Better Auth user ID
    userId: v.id("users"), // Local app user ID
    schoolId: v.optional(v.id("schools")), // School organization ID
    metadata: v.optional(v.record(v.string(), v.any())), // Additional Polar metadata
  })
    .index("userId", ["userId"]) // Query by app user ID
    .index("id", ["id"]) // Query by Polar customer ID
    .index("externalId", ["externalId"]) // Query by Better Auth user ID
    .index("schoolId", ["schoolId"]), // Query by school organization ID
};

export default tables;
