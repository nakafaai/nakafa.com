import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { cleanSlug } from "../utils/helper";
import { attachUsers } from "./utils";

/**
 * Get top-level comments for a content page.
 * Returns comments with user data attached.
 */
export const getParentCommentsBySlug = query({
  args: {
    slug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("contentSlug_depth", (q) =>
        q.eq("contentSlug", cleanSlug(args.slug)).eq("depth", 0)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const userMap = await attachUsers(ctx, comments.page);

    const enrichedComments = comments.page.map((comment) => ({
      ...comment,
      user: userMap.get(comment.userId) ?? null,
    }));

    return {
      ...comments,
      page: enrichedComments,
    };
  },
});

/**
 * Get replies to a specific comment.
 * Returns replies with user data attached.
 */
export const getRepliesByCommentId = query({
  args: {
    commentId: v.id("comments"),
    depth: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("comments")
      .withIndex("parentId_depth", (q) =>
        q.eq("parentId", args.commentId).eq("depth", args.depth)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const userMap = await attachUsers(ctx, replies.page);

    const enrichedReplies = replies.page.map((reply) => ({
      ...reply,
      user: userMap.get(reply.userId) ?? null,
    }));

    return {
      ...replies,
      page: enrichedReplies,
    };
  },
});

/**
 * Get all comments by a specific user.
 * Used for user profile pages.
 */
export const getCommentsByUserId = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts);

    return comments;
  },
});
