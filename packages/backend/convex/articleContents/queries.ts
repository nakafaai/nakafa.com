import { internalQuery } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/contentValidators";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Get article content by ID for audio script generation.
 * Internal use only - not exposed to clients.
 */
export const getById = internalQuery({
  args: {
    id: vv.id("articleContents"),
  },
  returns: nullable(
    v.object({
      title: v.string(),
      description: v.optional(v.string()),
      body: v.string(),
      locale: localeValidator,
      contentHash: v.string(),
    })
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
