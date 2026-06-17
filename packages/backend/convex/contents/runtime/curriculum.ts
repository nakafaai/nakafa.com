import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  formatContentDate,
  getContentAuthors,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/** Loads one curriculum lesson from the durable content read model. */
export async function getCurriculumPageImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const section = await ctx.db
    .query("curriculumLessons")
    .withIndex("by_locale_and_slug", (q) =>
      q.eq("locale", args.locale).eq("slug", args.slug)
    )
    .unique();

  if (!section) {
    return null;
  }

  const authors = await getContentAuthors(ctx, {
    contentId: section._id,
    contentType: "material",
  });

  return {
    body: section.body,
    contentHash: section.contentHash,
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
