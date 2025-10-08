import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  users: defineTable({
    email: v.string(),
    authId: v.optional(v.string()), // Reference to Better Auth user
  })
    .index("email", ["email"])
    .index("authId", ["authId"]),
};

export default tables;
