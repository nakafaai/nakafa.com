import { internalQuery } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";
import { localeValidator } from "@/convex/lib/validators/contents";
import { vv } from "@/convex/lib/validators/vv";

/**
 * Get subject section content by ID for audio script generation.
 * Internal use only - not exposed to clients.
 */
export const getById = internalQuery({
  args: {
    id: vv.id("subjectSections"),
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
