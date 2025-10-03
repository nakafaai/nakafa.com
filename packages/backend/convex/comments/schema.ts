import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  comments: defineTable({
    contentSlug: v.string(),
    // userId is v.string() because it references Better Auth's user table
    // which lives in the betterAuth component, not in this schema.
    // Using v.id("user") would fail because the user table is not in this database.
    userId: v.string(),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    // The depth of the comment in the thread.
    // A top-level comment has depth 0. A reply has depth parent.depth + 1.
    // This is capped at 3 to keep threads from getting too nested.
    depth: v.number(),
    mentions: v.optional(v.array(v.string())),
    upvoteCount: v.number(),
    downvoteCount: v.number(),
    score: v.number(),
  })
    .index("contentSlug", ["contentSlug"])
    .index("parentId", ["parentId"])
    .index("contentSlug_depth", ["contentSlug", "depth"])
    .index("parentId_depth", ["parentId", "depth"]),
  commentVotes: defineTable({
    commentId: v.id("comments"),
    // userId is v.string() for the same reason as above
    userId: v.string(),
    vote: v.union(v.literal(-1), v.literal(1)),
  })
    .index("commentId", ["commentId"])
    .index("userId", ["userId"])
    .index("commentId_userId", ["commentId", "userId"]),
};

export default tables;
