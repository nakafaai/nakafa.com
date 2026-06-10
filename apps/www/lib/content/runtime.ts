import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect } from "effect";
import { env } from "@/env";

type ArticlePageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getArticlePage
>;
type SubjectPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getSubjectPage
>;
type SubjectOutlineArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getSubjectOutline
>;
type ExerciseSetPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getExerciseSetPage
>;
type ExerciseQuestionPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getExerciseQuestionPage
>;
type ExerciseGroupPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getExerciseGroupPage
>;
type QuranSurahPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getQuranSurahPage
>;
type ContentRoutesPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>;
type ContentRoutesByKindPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByKindPrefix
>;
type ContentRoutesByParentPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByParent
>;
type ContentRouteArtifactPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRouteArtifactPage
>;
type ContentRouteCountsArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRouteCounts
>;
type LatestContentRoutesArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listLatestContentRoutes
>;
type ContentRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRoute
>;
type ArticleApiContentPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listArticleApiContentPage
>;
type SubjectApiContentPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listSubjectApiContentPage
>;
type LatestContentRoutes = FunctionReturnType<
  typeof api.contents.queries.runtime.listLatestContentRoutes
>;

/**
 * Reads an article page from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeArticlePage(args: ArticlePageArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getArticlePage, args);
}

/**
 * Reads a subject lesson from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeSubjectPage(args: SubjectPageArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getSubjectPage, args);
}

/**
 * Reads a subject outline from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeSubjectOutline(args: SubjectOutlineArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getSubjectOutline,
    args
  );
}

/**
 * Reads an exercise set from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeExerciseSetPage(args: ExerciseSetPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getExerciseSetPage,
    args
  );
}

/**
 * Reads one exercise question from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeExerciseQuestionPage(
  args: ExerciseQuestionPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getExerciseQuestionPage,
    args
  );
}

/**
 * Reads an exercise group from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeExerciseGroupPage(args: ExerciseGroupPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getExerciseGroupPage,
    args
  );
}

/**
 * Reads a Quran surah page from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeQuranSurahPage(args: QuranSurahPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getQuranSurahPage,
    args
  );
}

/**
 * Lists Quran surah metadata from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeQuranSurahs() {
  return fetchRuntimeQuery(api.contents.queries.runtime.listQuranSurahs, {});
}

/** Reads one route-catalog page from the Convex content runtime model. */
export function fetchRuntimeContentRoutesPage(args: ContentRoutesPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listContentRoutesByPrefix,
    args
  );
}

/** Reads one kind-scoped route-catalog page from the Convex content runtime model. */
export function fetchRuntimeContentRoutesByKindPage(
  args: ContentRoutesByKindPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listContentRoutesByKindPrefix,
    args
  );
}

/** Reads one parent-scoped route-catalog page from the Convex content runtime model. */
export function fetchRuntimeContentRoutesByParentPage(
  args: ContentRoutesByParentPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listContentRoutesByParent,
    args
  );
}

/** Reads one materialized route artifact page from the Convex content runtime model. */
export function fetchRuntimeContentRouteArtifactPage(
  args: ContentRouteArtifactPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getContentRouteArtifactPage,
    args
  );
}

/** Reads materialized route counts from the Convex content runtime model. */
export function fetchRuntimeContentRouteCounts(args: ContentRouteCountsArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listContentRouteCounts,
    args
  );
}

/** Reads newest dated route-catalog rows from the Convex content runtime model. */
export function fetchRuntimeLatestContentRoutes(args: LatestContentRoutesArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listLatestContentRoutes,
    args
  );
}

/** Reads one exact route-catalog row from the Convex content runtime model. */
export function fetchRuntimeContentRoute(args: ContentRouteArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getContentRoute, args);
}

/** Reads one article API content page from the Convex content runtime model. */
export function fetchRuntimeArticleApiContentPage(
  args: ArticleApiContentPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listArticleApiContentPage,
    args
  );
}

/** Reads one subject API content page from the Convex content runtime model. */
export function fetchRuntimeSubjectApiContentPage(
  args: SubjectApiContentPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listSubjectApiContentPage,
    args
  );
}

/**
 * Fetches one public content-runtime query through the official Convex client.
 *
 * `convex/nextjs` does not expose logger configuration. Its default
 * `ConvexHttpClient` logger allocates a random listener id, which Next Cache
 * Components reject during static prerender. A short-lived official client with
 * `logger: false` and a public custom fetch keeps this boundary framework-safe
 * without copying protocol.
 */
function fetchRuntimeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return fetchConvexRuntimeQuery(env.NEXT_PUBLIC_CONVEX_URL, query, args);
}

/** Wraps a Convex runtime query in the agent data-read error model. */
function fetchContentRuntimeQuery<T>(name: string, read: () => Promise<T>) {
  return Effect.tryPromise({
    try: read,
    /** Converts Convex/runtime read failures into the agent data-read error. */
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: `Unable to read Nakafa runtime content query: ${name}.`,
      }),
  });
}

/** Reads an article page from the Convex content runtime model. */
export const getRuntimeArticlePage = Effect.fn("www.contentRuntime.article")(
  function* (args: ArticlePageArgs) {
    return yield* fetchContentRuntimeQuery("getArticlePage", () =>
      fetchRuntimeArticlePage(args)
    );
  }
);

/** Reads a subject lesson from the Convex content runtime model. */
export const getRuntimeSubjectPage = Effect.fn("www.contentRuntime.subject")(
  function* (args: SubjectPageArgs) {
    return yield* fetchContentRuntimeQuery("getSubjectPage", () =>
      fetchRuntimeSubjectPage(args)
    );
  }
);

/** Reads a subject material outline from the Convex content runtime model. */
export const getRuntimeSubjectOutline = Effect.fn(
  "www.contentRuntime.subjectOutline"
)(function* (args: SubjectOutlineArgs) {
  return yield* fetchContentRuntimeQuery("getSubjectOutline", () =>
    fetchRuntimeSubjectOutline(args)
  );
});

/** Reads an exercise set from the Convex content runtime model. */
export const getRuntimeExerciseSetPage = Effect.fn(
  "www.contentRuntime.exerciseSet"
)(function* (args: ExerciseSetPageArgs) {
  return yield* fetchContentRuntimeQuery("getExerciseSetPage", () =>
    fetchRuntimeExerciseSetPage(args)
  );
});

/** Reads a single exercise question from the Convex content runtime model. */
export const getRuntimeExerciseQuestionPage = Effect.fn(
  "www.contentRuntime.exerciseQuestion"
)(function* (args: ExerciseQuestionPageArgs) {
  return yield* fetchContentRuntimeQuery("getExerciseQuestionPage", () =>
    fetchRuntimeExerciseQuestionPage(args)
  );
});

/** Reads an exercise group route from the Convex content runtime model. */
export const getRuntimeExerciseGroupPage = Effect.fn(
  "www.contentRuntime.exerciseGroup"
)(function* (args: ExerciseGroupPageArgs) {
  return yield* fetchContentRuntimeQuery("getExerciseGroupPage", () =>
    fetchRuntimeExerciseGroupPage(args)
  );
});

/** Reads a Quran surah page from the Convex content runtime model. */
export const getRuntimeQuranSurahPage = Effect.fn(
  "www.contentRuntime.quranSurah"
)(function* (args: QuranSurahPageArgs) {
  return yield* fetchContentRuntimeQuery("getQuranSurahPage", () =>
    fetchRuntimeQuranSurahPage(args)
  );
});

/** Lists Quran surah metadata from the Convex content runtime model. */
export const getRuntimeQuranSurahs = Effect.fn(
  "www.contentRuntime.quranSurahs"
)(function* () {
  return yield* fetchContentRuntimeQuery("listQuranSurahs", () =>
    fetchRuntimeQuranSurahs()
  );
});

/** Reads one bounded route-catalog page matching a locale, section, and prefix. */
export const getRuntimeContentRoutePage = Effect.fn(
  "www.contentRuntime.contentRoutePage"
)(function* (args: ContentRoutesPageArgs) {
  return yield* fetchContentRuntimeQuery("listContentRoutesByPrefix", () =>
    fetchRuntimeContentRoutesPage(args)
  );
});

/** Reads one bounded kind-scoped route-catalog page matching a route prefix. */
export const getRuntimeContentRouteKindPage = Effect.fn(
  "www.contentRuntime.contentRouteKindPage"
)(function* (args: ContentRoutesByKindPageArgs) {
  return yield* fetchContentRuntimeQuery("listContentRoutesByKindPrefix", () =>
    fetchRuntimeContentRoutesByKindPage(args)
  );
});

/** Reads one bounded parent-scoped route-catalog page. */
export const getRuntimeContentRouteParentPage = Effect.fn(
  "www.contentRuntime.contentRouteParentPage"
)(function* (args: ContentRoutesByParentPageArgs) {
  return yield* fetchContentRuntimeQuery("listContentRoutesByParent", () =>
    fetchRuntimeContentRoutesByParentPage(args)
  );
});

/** Reads one materialized route artifact page for sitemap and LLMS. */
export const getRuntimeContentRouteArtifactPage = Effect.fn(
  "www.contentRuntime.contentRouteArtifactPage"
)(function* (args: ContentRouteArtifactPageArgs) {
  return yield* fetchContentRuntimeQuery("getContentRouteArtifactPage", () =>
    fetchRuntimeContentRouteArtifactPage(args)
  );
});

/** Reads materialized route counts for one locale. */
export const getRuntimeContentRouteCounts = Effect.fn(
  "www.contentRuntime.contentRouteCounts"
)(function* (args: ContentRouteCountsArgs) {
  return yield* fetchContentRuntimeQuery("listContentRouteCounts", () =>
    fetchRuntimeContentRouteCounts(args)
  );
});

/** Lists newest dated content routes for capped feed surfaces. */
export const listRuntimeLatestContentRoutes = Effect.fn(
  "www.contentRuntime.latestContentRoutes"
)(function* (args: LatestContentRoutesArgs) {
  const routes: LatestContentRoutes = yield* fetchContentRuntimeQuery(
    "listLatestContentRoutes",
    () => fetchRuntimeLatestContentRoutes(args)
  );

  return routes;
});

/** Reads one exact route-catalog row from the Convex content runtime model. */
export const getRuntimeContentRoute = Effect.fn(
  "www.contentRuntime.contentRoute"
)(function* (args: ContentRouteArgs) {
  return yield* fetchContentRuntimeQuery("getContentRoute", () =>
    fetchRuntimeContentRoute(args)
  );
});

/** Reads one bounded article API content page from the Convex runtime model. */
export const getRuntimeArticleApiContentPage = Effect.fn(
  "www.contentRuntime.articleApiContentPage"
)(function* (args: ArticleApiContentPageArgs) {
  return yield* fetchContentRuntimeQuery("listArticleApiContentPage", () =>
    fetchRuntimeArticleApiContentPage(args)
  );
});

/** Reads one bounded subject API content page from the Convex runtime model. */
export const getRuntimeSubjectApiContentPage = Effect.fn(
  "www.contentRuntime.subjectApiContentPage"
)(function* (args: SubjectApiContentPageArgs) {
  return yield* fetchContentRuntimeQuery("listSubjectApiContentPage", () =>
    fetchRuntimeSubjectApiContentPage(args)
  );
});
