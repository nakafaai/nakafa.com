import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { toLearningContextQuery } from "@repo/backend/convex/contents/context";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  getDefaultPopularityWindow,
  type LearningPopularityWindow,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import {
  type GetTrendingSubjectsArgs,
  maxTrendingSubjectsLimit,
  TrendingSubjectIoError,
  trendingSubjectIoFailedCode,
} from "@repo/backend/convex/curriculumLessons/trending/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import type { TrendingSubject } from "@repo/backend/convex/lib/validators/trending";
import { cleanSlug } from "@repo/utilities/helper";
import { getAll } from "convex-helpers/server/relationships";
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

/** Normalizes caller-provided result filters to bounded query settings. */
function getTrendingSettings(args: GetTrendingSubjectsArgs) {
  const rawLimit = args.limit ?? defaultTrendingSubjectsLimit;
  const rawMinViews = args.minViews ?? defaultTrendingMinViews;
  const limit = Math.min(Math.max(rawLimit, 0), maxTrendingSubjectsLimit);
  const minViews = Math.max(rawMinViews, 0);
  const windowKey = args.windowKey ?? getDefaultPopularityWindow();

  return { limit, minViews, windowKey };
}

/** Reads aggregate-ranked counter IDs for one homepage popularity namespace. */
const loadRankedPopularityCounterIds = Effect.fn(
  "curriculumLessons.trending.loadRankedPopularityCounterIds"
)(function* (
  ctx: QueryCtx,
  args: GetTrendingSubjectsArgs,
  settings: {
    readonly limit: number;
    readonly minViews: number;
    readonly windowKey: LearningPopularityWindow;
  }
) {
  const result = yield* Effect.tryPromise({
    try: () =>
      learningPopularityRankings.paginate(ctx, {
        namespace: ["material", args.locale, "global", settings.windowKey],
        order: "asc",
        pageSize: settings.limit,
      }),
    catch: toTrendingSubjectIoError,
  });

  return result.page.map((item) => item.id);
});

/** Hydrates aggregate IDs back into current counter rows without changing order. */
const loadRankedPopularityCounters = Effect.fn(
  "curriculumLessons.trending.loadRankedPopularityCounters"
)(function* (
  ctx: QueryCtx,
  ids: readonly Doc<"learningPopularityCounters">["_id"][]
) {
  if (ids.length === 0) {
    return [];
  }

  const rows = yield* Effect.tryPromise({
    try: () => getAll(ctx.db, "learningPopularityCounters", ids),
    catch: toTrendingSubjectIoError,
  });

  return rows.flatMap((row) => (row ? [row] : []));
});

/** Exposes public route fields while keeping internal sourcePath out of UI rows. */
function toTrendingContentRef(
  route: Parameters<typeof buildContentSearchRef>[0]
) {
  const ref = buildContentSearchRef(route);

  return {
    alignmentId: ref.alignmentId,
    assetId: ref.assetId,
    conceptId: ref.conceptId,
    content_id: ref.content_id,
    learningObjectId: ref.learningObjectId,
    lensId: ref.lensId,
    locale: ref.locale,
    markdown_url: ref.markdown_url,
    route: ref.route,
    section: ref.section,
    url: ref.url,
  };
}

/** Projects a ranked popularity row to the public homepage card shape. */
function toTrendingSubject(
  row: Doc<"learningPopularityCounters">
): TrendingSubject[] {
  if (!row.materialDomain) {
    return [];
  }

  return [
    {
      ...toTrendingContentRef(row),
      contextKey: row.contextKey,
      description: row.description ?? "",
      href: `/${cleanSlug(row.route)}${toLearningContextQuery(row)}`,
      materialDomain: row.materialDomain,
      title: row.title,
      viewCount: row.score,
    },
  ];
}

/**
 * Lists trending subjects from the ranked popularity read model.
 *
 * The query uses equality filters for section, locale, and product-approved
 * window, then reads only the top-N score rows. No raw event or bucket scan is
 * performed at request time.
 * @see https://docs.convex.dev/understanding/best-practices/
 */
export const listTrendingSubjects = Effect.fn(
  "curriculumLessons.trending.listTrendingSubjects"
)(function* (ctx: QueryCtx, args: GetTrendingSubjectsArgs) {
  const settings = getTrendingSettings(args);

  if (settings.limit === 0) {
    return [];
  }

  const ids = yield* loadRankedPopularityCounterIds(ctx, args, settings);
  const rows = yield* loadRankedPopularityCounters(ctx, ids);

  return rows
    .filter((row) => row.score >= settings.minViews)
    .flatMap(toTrendingSubject);
});
