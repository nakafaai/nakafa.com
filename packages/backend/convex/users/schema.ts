import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  users: defineTable({
    email: v.string(),
    authId: v.string(), // Better Auth user ID
    role: v.optional(
      v.union(
        v.null(),
        v.literal("teacher"),
        v.literal("student"),
        v.literal("parent"),
        v.literal("admin")
      )
    ),
  })
    .index("email", ["email"]) // Query by email
    .index("authId", ["authId"]), // Query by Better Auth ID
};

export default tables;
