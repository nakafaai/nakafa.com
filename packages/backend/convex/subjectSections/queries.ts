import { internalQuery } from "@repo/backend/convex/_generated/server";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";

export const getById = internalQuery({
  args: {
    id: vv.id("subjectSections"),
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
    const section = await ctx.db.get(args.id);
    if (!section) {
      return null;
    }
    return {
      title: section.title,
      description: section.description,
      body: section.body,
      locale: section.locale,
      contentHash: section.contentHash,
    };
  },
});
