import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { trendingSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTrendingBucketStart,
  TRENDING_BUCKET_MS,
} from "@repo/backend/convex/subjectSections/utils";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRENDING_RANGE_DAYS = 31;

/**
 * Get trending subjects for a time range.
 *
 * Timestamps should be rounded to the helper's day bucket for caching.
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
    if (args.until <= args.since) {
      return [];
    }

    if (
      args.until - args.since >
      MAX_TRENDING_RANGE_DAYS * TRENDING_BUCKET_MS
    ) {
      throw new ConvexError({
        code: "INVALID_TRENDING_RANGE",
        message: `Trending range cannot exceed ${MAX_TRENDING_RANGE_DAYS} days.`,
      });
    }

    const limit = args.limit ?? 6;
    const minViews = args.minViews ?? 5;
    const since = getTrendingBucketStart(args.since);
    const until =
      getTrendingBucketStart(Math.max(args.since, args.until - 1)) +
      TRENDING_BUCKET_MS;

    const bucketsInRange = ctx.db
      .query("subjectTrendingBuckets")
      .withIndex("by_locale_bucketStart_contentId", (q) =>
        q
          .eq("locale", args.locale)
          .gte("bucketStart", since)
          .lt("bucketStart", until)
      );

    const countBySubject = new Map<Id<"subjectSections">, number>();

    for await (const bucket of bucketsInRange) {
      countBySubject.set(
        bucket.contentId,
        (countBySubject.get(bucket.contentId) ?? 0) + bucket.viewCount
      );
    }

    const trendingEntries = Array.from(countBySubject.entries())
      .filter(([, count]) => count >= minViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (trendingEntries.length === 0) {
      return [];
    }

    // Extract subject IDs and batch fetch using convex-helpers
    // This replaces N+1 sequential queries with a single batch operation
    const subjectIds = trendingEntries.map(([id]) => id);
    const subjects = await getAll(ctx.db, subjectIds);

    // Map to results maintaining sort order from trendingEntries
    const results = trendingEntries
      .map(([, viewCount], index) => {
        const subject = subjects[index];
        if (!subject) {
          return null;
        }
        return {
          id: subject._id,
          title: subject.title,
          description: subject.description,
          slug: subject.slug,
          viewCount,
          grade: subject.grade,
          material: subject.material,
        };
      })
      .filter((subject) => subject !== null);

    return results;
  },
});
