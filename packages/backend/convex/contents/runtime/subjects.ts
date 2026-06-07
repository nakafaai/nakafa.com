import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  formatContentDate,
  getContentAuthors,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/** Loads one subject lesson from the durable content read model. */
export async function getSubjectPageImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const section = await ctx.db
    .query("subjectSections")
    .withIndex("by_locale_and_slug", (q) =>
      q.eq("locale", args.locale).eq("slug", args.slug)
    )
    .unique();

  if (!section) {
    return null;
  }

  const authors = await getContentAuthors(ctx, {
    contentId: section._id,
    contentType: "subject",
  });

  return {
    body: section.body,
    category: section.category,
    contentHash: section.contentHash,
    grade: section.grade,
    material: section.material,
    metadata: {
      authors,
      date: formatContentDate(section.date),
      description: section.description,
      subject: section.subject,
      title: section.title,
    },
    section: section.section,
    slug: section.slug,
    syncedAt: section.syncedAt,
    topic: section.topic,
  };
}
