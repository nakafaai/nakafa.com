import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { toLearningContextQuery } from "@repo/backend/confect/contents/context";
import {
  POPULARITY_SCOPE,
  POPULARITY_SECTION,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { buildContentSearchRef } from "@repo/backend/confect/contents/search/documents";
import {
  type GetTrendingSubjectsArgs,
  TrendingSubjectIoError,
  trendingSubjectIoFailedCode,
} from "@repo/backend/confect/contents/trending/spec";
import { hydrateDurableContentTarget } from "@repo/backend/confect/contents/views/target";
import type { TrendingSubject } from "@repo/backend/confect/lib/validators/trending";
import { cleanSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, Struct } from "effect";

/** Cards the homepage list shows, and the size of one ranking page. */
const trendingSubjectsLimit = 6;
/** Views a lesson needs in the window to be listed. */
const trendingMinViews = 5;
const trendingRankingMaxPages = 5;

/** Maps thrown Convex IO failures into the trending-material error channel. */
function toTrendingSubjectIoError(error: unknown) {
  return new TrendingSubjectIoError({
    code: trendingSubjectIoFailedCode,
    cause: error,
    message: "Unable to load trending subjects.",
  });
}

/** Reads aggregate-ranked counter IDs for one homepage popularity namespace. */
const loadRankedPopularityCounterIds = Effect.fn(
  "contents.trending.loadRankedPopularityCounterIds"
)(function* (args: GetTrendingSubjectsArgs) {
  const ctx = yield* QueryCtxService;
  let ids: Docs["learningPopularityCounters"]["_id"][] = [];
  let cursor: string | undefined;
  let pagesRead = 0;
  while (pagesRead < trendingRankingMaxPages) {
    const result = yield* Effect.tryPromise({
      try: () =>
        learningPopularityRankings.paginate(ctx, {
          namespace: [
            POPULARITY_SECTION,
            args.locale,
            POPULARITY_SCOPE,
            POPULARITY_WINDOW,
          ],
          order: "asc",
          pageSize: trendingSubjectsLimit,
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
  const ids = yield* loadRankedPopularityCounterIds(args);
  const rows = yield* loadRankedPopularityCounters(ids);
  let subjects: TrendingSubject[] = [];
  for (const row of rows) {
    if (row.score < trendingMinViews) {
      continue;
    }
    const route = yield* loadCurrentTrendingRoute(row);
    if (!route) {
      continue;
    }
    subjects = Arr.append(subjects, toTrendingSubject(row, route));
    if (subjects.length >= trendingSubjectsLimit) {
      break;
    }
  }
  return subjects;
});
