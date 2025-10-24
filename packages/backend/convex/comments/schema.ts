import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  comments: defineTable({
    contentSlug: v.string(),
    userId: v.id("users"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    depth: v.number(), // 0 = top-level, max 5 to prevent deep nesting
    mentions: v.optional(v.array(v.string())),
    upvoteCount: v.number(),
    downvoteCount: v.number(),
    score: v.number(), // upvoteCount - downvoteCount
    replyCount: v.number(),
  })
    .index("contentSlug", ["contentSlug"]) // Query by content page
    .index("parentId", ["parentId"]) // Query replies
    .index("contentSlug_depth", ["contentSlug", "depth"]) // Query top-level comments
    .index("parentId_depth", ["parentId", "depth"]) // Query nested replies
    .index("userId", ["userId"]), // Query by user
  commentVotes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
    vote: v.union(v.literal(-1), v.literal(1)), // -1 = downvote, 1 = upvote
  })
    .index("commentId", ["commentId"]) // Query by comment
    .index("userId", ["userId"]) // Query by user
    .index("commentId_userId", ["commentId", "userId"]), // Check existing vote
};

export default tables;
