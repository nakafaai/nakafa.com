import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { toLearningContextQuery } from "@repo/backend/confect/contents/context";
import { buildContentSearchRef } from "@repo/backend/confect/contents/helpers/search/documents";
import {
  getDefaultPopularityWindow,
  type LearningPopularityWindow,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import {
  type GetTrendingSubjectsArgs,
  maxTrendingSubjectsLimit,
  TrendingSubjectIoError,
  trendingSubjectIoFailedCode,
} from "@repo/backend/confect/contents/trending/spec";
import { hydrateDurableContentTarget } from "@repo/backend/confect/contents/views/target";
import type { TrendingSubject } from "@repo/backend/confect/lib/validators/trending";
import { cleanSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, Struct } from "effect";

const defaultTrendingSubjectsLimit = 6;
const defaultTrendingMinViews = 5;
const trendingRankingMaxPages = 5;

/** Maps thrown Convex IO failures into the trending-material error channel. */
function toTrendingSubjectIoError(error: unknown) {
  return new TrendingSubjectIoError({
    code: trendingSubjectIoFailedCode,
    cause: error,
    message: "Unable to load trending subjects.",
  });
}

/** Normalizes caller-provided result filters to bounded query settings. */
function getTrendingSettings(args: GetTrendingSubjectsArgs) {
  const rawLimit = args.limit ?? defaultTrendingSubjectsLimit;
  const rawMinViews = args.minViews ?? defaultTrendingMinViews;
  const limit = Math.min(Math.max(rawLimit, 0), maxTrendingSubjectsLimit);
  const minViews = Math.max(rawMinViews, 0);
  const windowKey = args.windowKey ?? getDefaultPopularityWindow();
  return {
    limit,
    minViews,
    windowKey,
  };
}

/** Reads aggregate-ranked counter IDs for one homepage popularity namespace. */
const loadRankedPopularityCounterIds = Effect.fn(
  "contents.trending.loadRankedPopularityCounterIds"
)(function* (
  args: GetTrendingSubjectsArgs,
  settings: {
    readonly limit: number;
    readonly minViews: number;
    readonly windowKey: LearningPopularityWindow;
  }
) {
  const ctx = yield* QueryCtxService;
  let ids: Docs["learningPopularityCounters"]["_id"][] = [];
  let cursor: string | undefined;
  let pagesRead = 0;
  while (pagesRead < trendingRankingMaxPages) {
    const result = yield* Effect.tryPromise({
      try: () =>
        learningPopularityRankings.paginate(ctx, {
          namespace: ["material", args.locale, "global", settings.windowKey],
          order: "asc",
          pageSize: settings.limit,
          ...(cursor
            ? {
                cursor,
              }
            : {}),
        }),
      catch: toTrendingSubjectIoError,
    });
    ids = Arr.appendAll(
      ids,
      Arr.map(result.page, (item) => item.id)
    );
    pagesRead += 1;
    if (result.isDone) {
      break;
    }
    cursor = result.cursor;
  }
  return ids;
});

/** Hydrates aggregate IDs back into current counter rows without reordering. */
const loadRankedPopularityCounters = Effect.fn(
  "contents.trending.loadRankedPopularityCounters"
)(function* (ids: readonly Docs["learningPopularityCounters"]["_id"][]) {
  const database = yield* DatabaseReader;
  const rows = yield* Effect.forEach(ids, (id) =>
    database
      .table("learningPopularityCounters")
      .get(id)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.mapError(toTrendingSubjectIoError),
        Effect.catchDefect((cause) =>
          Effect.fail(toTrendingSubjectIoError(cause))
        )
      )
  );
  return Arr.flatMap(rows, (row) => (row ? [row] : []));
});

/** Loads the current signed material for a ranked popularity counter. */
const loadCurrentTrendingRoute = Effect.fn(
  "contents.trending.loadCurrentTrendingRoute"
)(function* (row: Docs["learningPopularityCounters"]) {
  const route = yield* hydrateDurableContentTarget({
    contentId: row.content_id,
    locale: row.locale,
    section: "material",
  }).pipe(Effect.mapError(toTrendingSubjectIoError));
  if (
    !(
      route &&
      route.locale === row.locale &&
      route.kind === "curriculum-lesson" &&
      route.content_id === route.assetId
    )
  ) {
    return;
  }
  return route;
});

/** Exposes public route fields while keeping internal sourcePath private. */
function toTrendingContentRef(
  route: Parameters<typeof buildContentSearchRef>[0]
) {
  return Struct.omit(buildContentSearchRef(route, true), ["sourcePath"]);
}

/** Projects a ranked popularity row to the public homepage card shape. */
function toTrendingSubject(
  row: Docs["learningPopularityCounters"],
  route: NonNullable<
    Effect.Success<ReturnType<typeof loadCurrentTrendingRoute>>
  >
): TrendingSubject {
  return {
    ...toTrendingContentRef(route),
    contextKey: row.contextKey,
    description: route.description ?? "",
    href: `/${cleanSlug(route.route)}${toLearningContextQuery(row)}`,
    materialDomain: route.materialDomain,
    title: route.title,
    viewCount: row.score,
  };
}

/**
 * Lists current signed materials from the ranked popularity read model.
 *
 * The query advances through bounded aggregate pages when stale rows are
 * filtered. It never scans raw events or publication history at request time.
 * @see https://docs.convex.dev/understanding/best-practices/
 */
export const listTrendingSubjects = Effect.fn(
  "contents.trending.listTrendingSubjects"
)(function* (args: GetTrendingSubjectsArgs) {
  const settings = getTrendingSettings(args);
  if (settings.limit === 0) {
    return [];
  }
  const ids = yield* loadRankedPopularityCounterIds(args, settings);
  const rows = yield* loadRankedPopularityCounters(ids);
  let subjects: TrendingSubject[] = [];
  for (const row of rows) {
    if (row.score < settings.minViews) {
      continue;
    }
    const route = yield* loadCurrentTrendingRoute(row);
    if (!route) {
      continue;
    }
    subjects = Arr.append(subjects, toTrendingSubject(row, route));
    if (subjects.length >= settings.limit) {
      break;
    }
  }
  return Arr.take(subjects, settings.limit);
});
