import { literals } from "@repo/backend/convex/lib/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Vote value validator: -1 = downvote, 1 = upvote
 */
export const commentVoteValidator = literals(-1, 1);

const tables = {
  comments: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    replyToUserId: v.optional(v.id("users")),
    // Denormalized preview of parent comment (stored at reply time, like Discord)
    replyToText: v.optional(v.string()),
    upvoteCount: v.number(),
    downvoteCount: v.number(),
    replyCount: v.number(),
  })
    .index("slug", ["slug"])
    .index("parentId", ["parentId"])
    .index("userId", ["userId"]),

  commentVotes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
    vote: commentVoteValidator,
  }).index("commentId_userId", ["commentId", "userId"]),
};

export default tables;
