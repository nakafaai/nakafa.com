import { internalQuery } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";

export const getById = internalQuery({
  args: {
    id: vv.id("articleContents"),
  },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.optional(v.string()),
      body: v.string(),
      locale: v.union(v.literal("en"), v.literal("id")),
      contentHash: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      return null;
    }
    return {
      title: article.title,
      description: article.description,
      body: article.body,
      locale: article.locale,
      contentHash: article.contentHash,
    };
  },
});
