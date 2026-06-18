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
type ContentRouteCountsArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRouteCounts
>;
type SitemapPublicRoutesArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listSitemapPublicRoutes
>;
type LatestContentRoutesArgs = FunctionArgs<
  typeof api.contents.queries.runtime.listLatestContentRoutes
>;
type ContentRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRoute
>;
type LatestContentRoutes = FunctionReturnType<
  typeof api.contents.queries.runtime.listLatestContentRoutes
>;

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

/** Reads one bounded sitemap public-route page from the Convex runtime model. */
export function fetchRuntimeSitemapPublicRoutes(args: SitemapPublicRoutesArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.listSitemapPublicRoutes,
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

/** Reads one bounded page of sitemap-eligible public context routes. */
export const getRuntimeSitemapPublicRoutes = Effect.fn(
  "www.contentRuntime.sitemapPublicRoutes"
)(function* (args: SitemapPublicRoutesArgs) {
  return yield* readRuntimeQuery("listSitemapPublicRoutes", () =>
    fetchRuntimeSitemapPublicRoutes(args)
  );
});

/** Lists newest dated content routes for capped feed surfaces. */
export const listRuntimeLatestContentRoutes = Effect.fn(
  "www.contentRuntime.latestContentRoutes"
)(function* (args: LatestContentRoutesArgs) {
  const routes: LatestContentRoutes = yield* readRuntimeQuery(
    "listLatestContentRoutes",
    () => fetchRuntimeLatestContentRoutes(args)
  );

  return routes;
});

/** Reads one exact route-catalog row from the Convex content runtime model. */
export const getRuntimeContentRoute = Effect.fn(
  "www.contentRuntime.contentRoute"
)(function* (args: ContentRouteArgs) {
  return yield* readRuntimeQuery("getContentRoute", () =>
    fetchRuntimeContentRoute(args)
  );
});
