import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { cleanSlug } from "../utils/helper";

export const getCommentsBySlug = query({
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
    return comments;
  },
});
