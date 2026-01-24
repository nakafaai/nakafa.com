import { internalMutation } from "@repo/backend/convex/functions";
import {
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { v } from "convex/values";

/**
 * Upsert a subject content document.
 * Creates if not exists, updates if contentHash changed.
 * Returns: { id, action: "created" | "updated" | "unchanged" }
 */
export const upsertSubjectContent = internalMutation({
  args: {
    locale: localeValidator,
    slug: v.string(),
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    topic: v.string(),
    section: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    subject: v.optional(v.string()),
    body: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("subjectContents")
      .withIndex("locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first();

    if (existing) {
      if (existing.contentHash === args.contentHash) {
        return { id: existing._id, action: "unchanged" as const };
      }

      await ctx.db.patch(existing._id, {
        category: args.category,
        grade: args.grade,
        material: args.material,
        topic: args.topic,
        section: args.section,
        title: args.title,
        description: args.description,
        date: args.date,
        subject: args.subject,
        body: args.body,
        contentHash: args.contentHash,
        syncedAt: now,
      });

      return { id: existing._id, action: "updated" as const };
    }

    const id = await ctx.db.insert("subjectContents", {
      locale: args.locale,
      slug: args.slug,
      category: args.category,
      grade: args.grade,
      material: args.material,
      topic: args.topic,
      section: args.section,
      title: args.title,
      description: args.description,
      date: args.date,
      subject: args.subject,
      body: args.body,
      contentHash: args.contentHash,
      syncedAt: now,
    });

    return { id, action: "created" as const };
  },
});
