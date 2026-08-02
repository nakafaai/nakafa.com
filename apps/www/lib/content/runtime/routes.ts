import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

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
/** One route row returned by the bounded content artifact catalog. */
export type RuntimeContentRoute = NonNullable<
  FunctionReturnType<
    typeof api.contents.queries.runtime.getContentRouteArtifactPage
  >
>["routes"][number];
type ContentRouteCountsArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRouteCounts
>;
type ContentSitemapPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentSitemapPage
>;
type PublicSitemapCountArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getPublicSitemapCount
>;
type PublicSitemapPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getPublicSitemapPage
>;
type LatestContentRoutePageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listLatestContentRoutePage
>;
type ContentRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRoute
>;
type PublicRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getPublicRouteByPath
>;
type TryoutRouteArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getRoute
>;
type TryoutMetadataArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getMetadata
>;
/** One bounded newest-first page from the content route catalog. */
export type RuntimeLatestContentRoutePage = FunctionReturnType<
  typeof api.contents.queries.runtime.listLatestContentRoutePage
>;
/** One dated route returned by the newest-first content catalog. */
export type RuntimeLatestContentRoute =
  RuntimeLatestContentRoutePage["page"][number];

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

/** Reads one sitemap-sized group of content route artifacts. */
function fetchRuntimeContentSitemapPage(args: ContentSitemapPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getContentSitemapPage,
    args
  );
}

/** Reads one locale's bounded public sitemap page count. */
function fetchRuntimePublicSitemapCount(args: PublicSitemapCountArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getPublicSitemapCount,
    args
  );
}

/** Reads one exact bounded public sitemap page. */
function fetchRuntimePublicSitemapPage(args: PublicSitemapPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getPublicSitemapPage,
    args
  );
}

/** Reads one newest-first route-catalog page from the Convex runtime model. */
export function fetchRuntimeLatestContentRoutePage(
  args: LatestContentRoutePageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listLatestContentRoutePage,
    args
  );
}

/** Reads one exact route-catalog row from the Convex content runtime model. */
export function fetchRuntimeContentRoute(args: ContentRouteArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getContentRoute, args);
}

/** Reads one exact public route from the indexed Convex route projection. */
function fetchRuntimePublicRoute(args: PublicRouteArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getPublicRouteByPath,
    args
  );
}

/** Reads one bounded route-catalog page matching a locale, section, and prefix. */
export const getRuntimeContentRoutePage = Effect.fn(
  "www.contentRuntime.contentRoutePage"
)(function* (args: ContentRoutesPageArgs) {
  return yield* readRuntimeQuery("listContentRoutesByPrefix", () =>
    fetchRuntimeContentRoutesPage(args)
  );
});

/** Reads one bounded kind-scoped route-catalog page matching a route prefix. */
export const getRuntimeContentRouteKindPage = Effect.fn(
  "www.contentRuntime.contentRouteKindPage"
)(function* (args: ContentRoutesByKindPageArgs) {
  return yield* readRuntimeQuery("listContentRoutesByKindPrefix", () =>
    fetchRuntimeContentRoutesByKindPage(args)
  );
});

/** Reads one bounded parent-scoped route-catalog page. */
export const getRuntimeContentRouteParentPage = Effect.fn(
  "www.contentRuntime.contentRouteParentPage"
)(function* (args: ContentRoutesByParentPageArgs) {
  return yield* readRuntimeQuery("listContentRoutesByParent", () =>
    fetchRuntimeContentRoutesByParentPage(args)
  );
});

/** Reads one materialized route artifact page for sitemap and LLMS. */
export const getRuntimeContentRouteArtifactPage = Effect.fn(
  "www.contentRuntime.contentRouteArtifactPage"
)(function* (args: ContentRouteArtifactPageArgs) {
  return yield* readRuntimeQuery("getContentRouteArtifactPage", () =>
    fetchRuntimeContentRouteArtifactPage(args)
  );
});

/** Reads materialized route counts for one locale. */
export const getRuntimeContentRouteCounts = Effect.fn(
  "www.contentRuntime.contentRouteCounts"
)(function* (args: ContentRouteCountsArgs) {
  return yield* readRuntimeQuery("listContentRouteCounts", () =>
    fetchRuntimeContentRouteCounts(args)
  );
});

/** Reads one sitemap-sized group of content route artifacts. */
export const getRuntimeContentSitemapPage = Effect.fn(
  "www.contentRuntime.contentSitemapPage"
)(function* (args: ContentSitemapPageArgs) {
  return yield* readRuntimeQuery("getContentSitemapPage", () =>
    fetchRuntimeContentSitemapPage(args)
  );
});

/** Reads one locale's bounded public sitemap page count. */
export const getRuntimePublicSitemapCount = Effect.fn(
  "www.contentRuntime.publicSitemapCount"
)(function* (args: PublicSitemapCountArgs) {
  return yield* readRuntimeQuery("getPublicSitemapCount", () =>
    fetchRuntimePublicSitemapCount(args)
  );
});

/** Reads one exact bounded public sitemap page. */
export const getRuntimePublicSitemapPage = Effect.fn(
  "www.contentRuntime.publicSitemapPage"
)(function* (args: PublicSitemapPageArgs) {
  return yield* readRuntimeQuery("getPublicSitemapPage", () =>
    fetchRuntimePublicSitemapPage(args)
  );
});

/** Reads one newest-first dated route page for capped feed surfaces. */
export const getRuntimeLatestContentRoutePage = Effect.fn(
  "www.contentRuntime.latestContentRoutePage"
)(function* (args: LatestContentRoutePageArgs) {
  const page: RuntimeLatestContentRoutePage = yield* readRuntimeQuery(
    "listLatestContentRoutePage",
    () => fetchRuntimeLatestContentRoutePage(args)
  );

  return page;
});

/** Reads one exact route-catalog row from the Convex content runtime model. */
export const getRuntimeContentRoute = Effect.fn(
  "www.contentRuntime.contentRoute"
)(function* (args: ContentRouteArgs) {
  return yield* readRuntimeQuery("getContentRoute", () =>
    fetchRuntimeContentRoute(args)
  );
});

/** Reads one exact public route through its locale and localized public path. */
export const getRuntimePublicRoute = Effect.fn(
  "www.contentRuntime.publicRoute"
)(function* (args: PublicRouteArgs) {
  return yield* readRuntimeQuery("getPublicRouteByPath", () =>
    fetchRuntimePublicRoute(args)
  );
});

/** Resolves one localized public path against signed try-out ownership. */
export const getRuntimeTryoutRoute = Effect.fn(
  "www.contentRuntime.tryoutRoute"
)(function* (args: TryoutRouteArgs) {
  return yield* readRuntimeQuery("getTryoutRoute", () =>
    fetchRuntimeQuery(api.tryouts.queries.catalog.getRoute, args)
  );
});

/** Reads signed SEO copy and localized paths for one exact try-out route. */
export const getRuntimeTryoutMetadata = Effect.fn(
  "www.contentRuntime.tryoutMetadata"
)(function* (args: TryoutMetadataArgs) {
  return yield* readRuntimeQuery("getTryoutMetadata", () =>
    fetchRuntimeQuery(api.tryouts.queries.catalog.getMetadata, args)
  );
});
