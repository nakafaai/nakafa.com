import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

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
type ContentRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRoute
>;
type PublicRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getPublicRouteByPath
>;
type TryoutRouteArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getRoute
>;
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
