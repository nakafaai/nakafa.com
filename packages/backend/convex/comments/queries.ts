import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { cleanSlug } from "../utils/helper";
import { attachUsers } from "./utils";

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

    // Get user data for comments
    const userMap = await attachUsers(ctx, comments.page);

    // Enrich comments with user data and replies
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

    // Get user data for replies
    const userMap = await attachUsers(ctx, replies.page);

    // Enrich replies with user data
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
