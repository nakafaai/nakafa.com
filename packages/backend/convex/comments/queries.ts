import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { query } from "../_generated/server";
import type { DataModel } from "../betterAuth/_generated/dataModel";
import { cleanSlug } from "../utils/helper";

export type CommentUser = {
  name: DataModel["user"]["document"]["name"];
  image: DataModel["user"]["document"]["image"];
};

export const getParentCommentsBySlug = query({
  args: {
    slug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("contentSlug", (q) =>
        q.eq("contentSlug", cleanSlug(args.slug))
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // Get unique user IDs for batch fetching
    const uniqueUserIds = [...new Set(comments.page.map((c) => c.userId))];

    // Batch fetch all users using Better Auth adapter
    const users = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          select: ["name", "image"],
          where: [
            {
              field: "id",
              value: userId,
              operator: "eq",
            },
          ],
        });
        return { userId, user };
      })
    );

    // Create user map
    const userMap = new Map<string, CommentUser>(
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

    // Enrich comments with user data
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
