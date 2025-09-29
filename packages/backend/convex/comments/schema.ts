import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  comments: defineTable({
    contentSlug: v.string(),
    userId: v.id("user"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    // The depth of the comment in the thread.
    // A top-level comment has depth 0. A reply has depth parent.depth + 1.
    // This is capped at 3 to keep threads from getting too nested.
    depth: v.number(),
    mentions: v.optional(v.array(v.id("user"))),
  })
    .index("contentSlug", ["contentSlug"])
    .index("parentId", ["parentId"]),
};

export default tables;
