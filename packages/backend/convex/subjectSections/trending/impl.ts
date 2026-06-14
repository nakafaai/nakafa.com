import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  type GetTrendingSubjectsArgs,
  InvalidTrendingRangeError,
  invalidTrendingRangeCode,
  maxTrendingRangeDays,
  maxTrendingSubjectsLimit,
  TrendingSubjectIoError,
  trendingSubjectIoFailedCode,
} from "@repo/backend/convex/subjectSections/trending/spec";
import {
  getTrendingBucketStart,
  TRENDING_BUCKET_MS,
} from "@repo/backend/convex/subjectSections/utils";
import { Effect } from "effect";

const defaultTrendingSubjectsLimit = 6;
const defaultTrendingMinViews = 5;

/** Maps thrown Convex IO failures into the trending-subject error channel. */
function toTrendingSubjectIoError(error: unknown) {
  return new TrendingSubjectIoError({
    code: trendingSubjectIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Computes a bounded, day-bucketed trending query window. */
function getTrendingWindow(args: GetTrendingSubjectsArgs) {
  if (args.until <= args.since) {
    return null;
  }

  const maxRangeMs = maxTrendingRangeDays * TRENDING_BUCKET_MS;

  if (args.until - args.since > maxRangeMs) {
    return new InvalidTrendingRangeError({
      code: invalidTrendingRangeCode,
      message: `Trending range cannot exceed ${maxTrendingRangeDays} days.`,
    });
  }

  const since = getTrendingBucketStart(args.since);
  const until =
    getTrendingBucketStart(Math.max(args.since, args.until - 1)) +
    TRENDING_BUCKET_MS;

  return { since, until };
}

/** Normalizes caller-provided result filters to bounded query settings. */
function getTrendingSettings(args: GetTrendingSubjectsArgs) {
  const rawLimit = args.limit ?? defaultTrendingSubjectsLimit;
  const rawMinViews = args.minViews ?? defaultTrendingMinViews;
  const limit = Math.min(Math.max(rawLimit, 0), maxTrendingSubjectsLimit);
  const minViews = Math.max(rawMinViews, 0);

  return { limit, minViews };
}

/** Reads daily trending bucket counts inside one indexed locale/range scan. */
const loadSubjectViewCounts = Effect.fn(
  "subjectSections.trending.loadSubjectViewCounts"
)(function* (
  ctx: QueryCtx,
  args: GetTrendingSubjectsArgs,
  window: {
    readonly since: number;
    readonly until: number;
  }
) {
  return yield* Effect.tryPromise({
    try: async () => {
      const bucketsInRange = ctx.db
        .query("learningTrendingBuckets")
        .withIndex(
          "by_section_and_locale_and_bucketStart_and_content_id",
          (q) =>
            q
              .eq("section", "subject")
              .eq("locale", args.locale)
              .gte("bucketStart", window.since)
              .lt("bucketStart", window.until)
        );

      const countBySubject = new Map<
        Doc<"contentRoutes">["content_id"],
        number
      >();

      for await (const bucket of bucketsInRange) {
        countBySubject.set(
          bucket.content_id,
          (countBySubject.get(bucket.content_id) ?? 0) + bucket.viewCount
        );
      }

      return countBySubject;
    },
    catch: toTrendingSubjectIoError,
  });
});

/** Builds the sorted top-subject entries from aggregated daily bucket counts. */
function getTopTrendingEntries(
  countBySubject: ReadonlyMap<Doc<"contentRoutes">["content_id"], number>,
  settings: {
    readonly limit: number;
    readonly minViews: number;
  }
) {
  return Array.from(countBySubject.entries())
    .filter(([, count]) => count >= settings.minViews)
    .sort((a, b) => b[1] - a[1])
    .slice(0, settings.limit);
}

/** Loads subject documents and preserves the already-sorted trending order. */
const buildTrendingSubjects = Effect.fn(
  "subjectSections.trending.buildTrendingSubjects"
)(function* (
  ctx: QueryCtx,
  trendingEntries: readonly (readonly [
    Doc<"contentRoutes">["content_id"],
    number,
  ])[]
) {
  const results = yield* Effect.forEach(
    trendingEntries,
    ([contentId, viewCount]) =>
      loadSubjectRoute(ctx, contentId).pipe(
        Effect.flatMap((route) => {
          if (!route) {
            return Effect.succeed([]);
          }

          return loadSubjectSection(ctx, route).pipe(
            Effect.map((subject) => {
              if (!subject) {
                return [];
              }

              return [
                {
                  ...buildContentSearchRef(route),
                  description: route.description ?? "",
                  grade: subject.grade,
                  material: subject.material,
                  title: route.title,
                  viewCount,
                },
              ];
            })
          );
        })
      )
  );

  return results.flat();
});

/** Loads the graph route projection for one trending subject section. */
const loadSubjectRoute = Effect.fn("subjectSections.trending.loadSubjectRoute")(
  function* (ctx: QueryCtx, contentId: Doc<"contentRoutes">["content_id"]) {
    const route = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("contentRoutes")
          .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
          .unique(),
      catch: toTrendingSubjectIoError,
    });

    if (
      route?.kind !== "subject-section" ||
      route.content_id !== route.assetId
    ) {
      return null;
    }

    return route;
  }
);

/** Loads subject metadata for one verified graph route projection. */
const loadSubjectSection = Effect.fn(
  "subjectSections.trending.loadSubjectSection"
)(function* (ctx: QueryCtx, route: Doc<"contentRoutes">) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", route.locale).eq("slug", route.route)
        )
        .unique(),
    catch: toTrendingSubjectIoError,
  });
});

/**
 * Lists trending subjects from the bounded daily bucket read model.
 *
 * The query scans only the locale/range index, aggregates counts in memory for
 * the requested window, then batch-loads only the top subject documents.
 * @see https://docs.convex.dev/understanding/best-practices/#only-use-collect-with-a-small-number-of-results
 * @see https://docs.convex.dev/database/pagination
 * @see https://effect.website/docs/error-management/expected-errors/
 */
export const listTrendingSubjects = Effect.fn(
  "subjectSections.trending.listTrendingSubjects"
)(function* (ctx: QueryCtx, args: GetTrendingSubjectsArgs) {
  const window = getTrendingWindow(args);

  if (!window) {
    return [];
  }

  if (window instanceof InvalidTrendingRangeError) {
    return yield* Effect.fail(window);
  }

  const settings = getTrendingSettings(args);

  if (settings.limit === 0) {
    return [];
  }

  const countBySubject = yield* loadSubjectViewCounts(ctx, args, window);
  const trendingEntries = getTopTrendingEntries(countBySubject, settings);

  if (trendingEntries.length === 0) {
    return [];
  }

  return yield* buildTrendingSubjects(ctx, trendingEntries);
});
