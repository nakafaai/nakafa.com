import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import type { DataModel } from "../betterAuth/_generated/dataModel";

import { cleanSlug } from "../utils/helper";

export type CommentUser = {
  name: DataModel["user"]["document"]["name"];
  image: DataModel["user"]["document"]["image"];
};

async function attachUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const uniqueUserIds = [...new Set(comments.map((c) => c.userId))];
  const users = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        select: ["name", "image"],
        where: [
          {
            field: "_id",
            value: userId,
            operator: "eq",
          },
        ],
      });
      return { userId, user };
    })
  );
  return new Map<string, CommentUser>(
    users
      .filter((item) => item.user !== null && item.user !== undefined)
      .map(({ userId, user }) => [
        userId,
        {
          name: user.name,
          image: user.image,
        },
      ])
  );
}

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
    userId: v.string(),
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
