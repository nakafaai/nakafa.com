import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery, query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  type TrendingSubject,
  trendingSubjectValidator,
} from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { nullable } from "convex-helpers/validators";

/**
 * Get subject section content by ID.
 */
export const getById = internalQuery({
  args: {
    id: vv.id("subjectSections"),
  },
  returns: nullable(
    vv.object({
      title: vv.string(),
      description: vv.optional(vv.string()),
      body: vv.string(),
      locale: localeValidator,
      contentHash: vv.string(),
    })
  ),
  handler: async (ctx, args) => {
    const section = await ctx.db.get("subjectSections", args.id);
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

/**
 * Get trending subjects for a time range.
 *
 * Timestamps should be rounded to nearest hour for caching.
 * Use getTrendingTimeRange() helper.
 *
 * @see https://docs.convex.dev/understanding/best-practices/#date-in-queries
 * @see https://docs.convex.dev/understanding/best-practices/#only-use-collect-with-a-small-number-of-results
 */
export const getTrendingSubjects = query({
  args: {
    locale: localeValidator,
    since: vv.number(),
    until: vv.number(),
    limit: vv.optional(vv.number()),
    minViews: vv.optional(vv.number()),
  },
  returns: vv.array(trendingSubjectValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 6;
    const minViews = args.minViews ?? 5;

    // Use .take() instead of .collect() to prevent unbounded queries
    // This limits results to MAX_VIEWS most recent views in the range
    const viewsInRange = await ctx.db
      .query("contentViews")
      .withIndex("by_locale_type_viewedAt", (q) =>
        q
          .eq("locale", args.locale)
          .eq("contentRef.type", "subject")
          .gte("viewedAt", args.since)
          .lt("viewedAt", args.until)
      )
      .take(1000);

    const countBySubject = new Map<Id<"subjectSections">, number>();
    const slugBySubject = new Map<Id<"subjectSections">, string>();

    for (const view of viewsInRange) {
      // Type narrowing: index filters by type, but TS needs explicit check
      if (view.contentRef.type === "subject") {
        const subjectId = view.contentRef.id;
        countBySubject.set(subjectId, (countBySubject.get(subjectId) ?? 0) + 1);
        if (!slugBySubject.has(subjectId)) {
          slugBySubject.set(subjectId, view.slug);
        }
      }
    }

    const trendingEntries = Array.from(countBySubject.entries())
      .filter(([, count]) => count >= minViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (trendingEntries.length === 0) {
      return [];
    }

    const results: TrendingSubject[] = [];

    for (const [subjectId, viewCount] of trendingEntries) {
      const subject = await ctx.db.get("subjectSections", subjectId);
      if (!subject) {
        continue;
      }

      results.push({
        id: subject._id,
        title: subject.title,
        description: subject.description,
        slug: slugBySubject.get(subjectId) ?? subject.slug,
        viewCount,
        grade: subject.grade,
        material: subject.material,
      });
    }

    return results;
  },
});
