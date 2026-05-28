import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import {
  getTrendingBucketStart,
  TRENDING_BUCKET_MS,
} from "@repo/backend/confect/modules/content/trending/time";
import { Effect, Schema } from "effect";

const MAX_TRENDING_RANGE_DAYS = 31;
const DEFAULT_TRENDING_LIMIT = 6;
const DEFAULT_TRENDING_MIN_VIEWS = 5;

export class TrendingRangeError extends Schema.TaggedError<TrendingRangeError>()(
  "TrendingRangeError",
  { message: Schema.String }
) {}

/** Returns trending subject sections for a locale and bounded time range. */
export const getTrendingSubjects = Effect.fn("content.getTrendingSubjects")(
  function* (args: {
    limit?: number;
    locale: Locale;
    minViews?: number;
    since: number;
    until: number;
  }) {
    if (args.until <= args.since) {
      return [];
    }

    if (
      args.until - args.since >
      MAX_TRENDING_RANGE_DAYS * TRENDING_BUCKET_MS
    ) {
      return yield* Effect.fail(
        new TrendingRangeError({
          message: `Trending range cannot exceed ${MAX_TRENDING_RANGE_DAYS} days.`,
        })
      );
    }

    const reader = yield* DatabaseReader;
    const limit = args.limit ?? DEFAULT_TRENDING_LIMIT;
    const minViews = args.minViews ?? DEFAULT_TRENDING_MIN_VIEWS;
    const since = getTrendingBucketStart(args.since);
    const until =
      getTrendingBucketStart(Math.max(args.since, args.until - 1)) +
      TRENDING_BUCKET_MS;

    const bucketsInRange = yield* reader
      .table("subjectTrendingBuckets")
      .index("by_locale_and_bucketStart_and_contentId", (query) =>
        query
          .eq("locale", args.locale)
          .gte("bucketStart", since)
          .lt("bucketStart", until)
      )
      .collect();
    const zeroViews = Number(0);
    const countBySubject = new Map(
      bucketsInRange.map((bucket) => [bucket.contentId, zeroViews] as const)
    );

    for (const bucket of bucketsInRange) {
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

    const subjectResults = yield* Effect.forEach(
      trendingEntries,
      ([subjectId, viewCount]) =>
        Effect.gen(function* () {
          const subject = yield* reader
            .table("subjectSections")
            .get(subjectId)
            .pipe(
              Effect.catchTag("GetByIdFailure", () => Effect.succeed(null))
            );

          if (!subject) {
            return null;
          }

          return {
            description: subject.description,
            grade: subject.grade,
            id: subject._id,
            material: subject.material,
            slug: subject.slug,
            title: subject.title,
            viewCount,
          };
        })
    );
    const results = subjectResults.filter((subject) => subject !== null);

    return results;
  }
);
