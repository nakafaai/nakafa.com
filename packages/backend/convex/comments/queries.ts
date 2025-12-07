import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { cleanSlug } from "../utils/helper";
import { attachReplyToUsers, attachUsers } from "./utils";

export const getCommentsBySlug = query({
  args: {
    slug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("slug", (q) => q.eq("slug", cleanSlug(args.slug)))
      .order("desc")
      .paginate(args.paginationOpts);

    const [userMap, replyToUserMap] = await Promise.all([
      attachUsers(ctx, comments.page),
      attachReplyToUsers(ctx, comments.page),
    ]);

    return {
      ...comments,
      page: comments.page.map((comment) => ({
        ...comment,
        user: userMap.get(comment.userId) ?? null,
        replyToUser: comment.replyToUserId
          ? (replyToUserMap.get(comment.replyToUserId) ?? null)
          : null,
      })),
    };
  },
});

export const getCommentsByUserId = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("comments")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts),
});
