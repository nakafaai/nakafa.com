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
const trendingRankingMaxPages = 5;

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
  const ids: Doc<"learningPopularityCounters">["_id"][] = [];
  let cursor: string | undefined;
  let pagesRead = 0;

  while (pagesRead < trendingRankingMaxPages) {
    const result = yield* Effect.tryPromise({
      try: () =>
        learningPopularityRankings.paginate(ctx, {
          namespace: ["material", args.locale, "global", settings.windowKey],
          order: "asc",
          pageSize: settings.limit,
          ...(cursor ? { cursor } : {}),
        }),
      catch: toTrendingSubjectIoError,
    });

    ids.push(...result.page.map((item) => item.id));
    pagesRead += 1;

    if (result.isDone) {
      break;
    }

    cursor = result.cursor;
  }

  return ids;
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

/** Loads the current public route row for a ranked popularity counter. */
const loadCurrentTrendingRoute = Effect.fn(
  "curriculumLessons.trending.loadCurrentTrendingRoute"
)(function* (ctx: QueryCtx, row: Doc<"learningPopularityCounters">) {
  const route = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", row.content_id))
        .unique(),
    catch: toTrendingSubjectIoError,
  });

  if (
    !(
      route &&
      route.locale === row.locale &&
      route.kind === "curriculum-lesson" &&
      route.section === "material" &&
      route.content_id === route.assetId
    )
  ) {
    return;
  }

  return route;
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
  row: Doc<"learningPopularityCounters">,
  route: Doc<"contentRoutes">
): TrendingSubject[] {
  if (!route.materialDomain) {
    return [];
  }

  return [
    {
      ...toTrendingContentRef(route),
      contextKey: row.contextKey,
      description: route.description ?? "",
      href: `/${cleanSlug(route.route)}${toLearningContextQuery(row)}`,
      materialDomain: route.materialDomain,
      title: route.title,
      viewCount: row.score,
    },
  ];
}

/**
 * Lists trending subjects from the ranked popularity read model.
 *
 * The query uses the Aggregate ranked index for section, locale, and approved
 * window, then advances through bounded pages when stale rows are filtered.
 * No raw event or bucket scan is performed at request time.
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
  const subjects: TrendingSubject[] = [];

  for (const row of rows) {
    if (row.score < settings.minViews) {
      continue;
    }

    const route = yield* loadCurrentTrendingRoute(ctx, row);

    if (!route) {
      continue;
    }

    subjects.push(...toTrendingSubject(row, route));

    if (subjects.length >= settings.limit) {
      break;
    }
  }

  return subjects.slice(0, settings.limit);
});
