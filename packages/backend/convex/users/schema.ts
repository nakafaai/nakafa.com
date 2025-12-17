import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  users: defineTable({
    email: v.string(),
    authId: v.string(), // Better Auth user ID
    // Denormalized from auth - synced via triggers for fast lookups
    name: v.string(),
    image: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.null(),
        v.literal("teacher"),
        v.literal("student"),
        v.literal("parent"),
        v.literal("administrator")
      )
    ),
  })
    .index("email", ["email"]) // Query by email
    .index("authId", ["authId"]), // Query by Better Auth ID
};

export default tables;
