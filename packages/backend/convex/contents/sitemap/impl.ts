import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import {
  CONTENT_SITEMAP_ARTIFACT_PAGE_COUNT,
  CONTENT_SITEMAP_ROUTE_PAGE_SIZE,
  type ContentSitemapRoute,
  type GetContentSitemapPageArgs,
  type GetPublicSitemapCountArgs,
  type GetPublicSitemapPageArgs,
  PUBLIC_SITEMAP_PAGE_SIZE,
  PUBLIC_SITEMAP_ROUTE_KIND,
} from "@repo/backend/convex/contents/sitemap/spec";
import { Effect, Schema } from "effect";

class SitemapRuntimeError extends Schema.TaggedError<SitemapRuntimeError>()(
  "SitemapRuntimeError",
  {
    code: Schema.Literal(
      "CONTENT_SITEMAP_PAGE_INTEGRITY",
      "CONTENT_SITEMAP_PAGE_INVALID",
      "CONTENT_SITEMAP_PAGE_OVERFLOW",
      "PUBLIC_SITEMAP_PAGE_INTEGRITY",
      "PUBLIC_SITEMAP_PAGE_INVALID",
      "PUBLIC_SITEMAP_PAGE_OVERFLOW"
    ),
    message: Schema.String,
  }
) {}

/** Reads one sitemap-sized group of existing bounded content artifacts. */
export const getContentSitemapPageImpl = Effect.fn(
  "contents.contentSitemap.getPage"
)(function* (ctx: QueryCtx, args: GetContentSitemapPageArgs) {
  if (!Number.isSafeInteger(args.page) || args.page < 0) {
    return yield* contentSitemapError(
      "CONTENT_SITEMAP_PAGE_INVALID",
      "Content sitemap page must be a non-negative integer."
    );
  }

  const count = yield* Effect.promise(() =>
    ctx.db
      .query("contentRouteCounts")
      .withIndex("by_locale_and_section", (query) =>
        query.eq("locale", args.locale).eq("section", args.section)
      )
      .unique()
  );

  if (!count) {
    return null;
  }

  if (!Number.isSafeInteger(count.count) || count.count < 0) {
    return yield* contentSitemapError(
      "CONTENT_SITEMAP_PAGE_INTEGRITY",
      `Content sitemap count for ${args.locale}/${args.section} is invalid.`
    );
  }

  const pageCount = Math.ceil(count.count / CONTENT_SITEMAP_ROUTE_PAGE_SIZE);
  if (args.page >= pageCount) {
    return null;
  }

  const firstArtifactPage = args.page * CONTENT_SITEMAP_ARTIFACT_PAGE_COUNT;
  const expectedRouteCount = Math.min(
    CONTENT_SITEMAP_ROUTE_PAGE_SIZE,
    count.count - args.page * CONTENT_SITEMAP_ROUTE_PAGE_SIZE
  );
  const expectedArtifactCount = Math.ceil(
    expectedRouteCount / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE
  );
  const pages = yield* Effect.promise(() =>
    ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section_and_page", (query) =>
        query
          .eq("locale", args.locale)
          .eq("section", args.section)
          .gte("page", firstArtifactPage)
          .lt("page", firstArtifactPage + expectedArtifactCount)
      )
      .take(expectedArtifactCount + 1)
  );

  if (pages.length > expectedArtifactCount) {
    return yield* contentSitemapError(
      "CONTENT_SITEMAP_PAGE_OVERFLOW",
      `Content sitemap page ${args.locale}/${args.section}/${args.page} exceeds its artifact bound.`
    );
  }

  const routes: ContentSitemapRoute[] = [];

  for (const [index, page] of pages.entries()) {
    const expectedPage = firstArtifactPage + index;
    const valid =
      page.page === expectedPage &&
      page.routeCount === page.routes.length &&
      page.routes.length <= CONTENT_ROUTE_ARTIFACT_PAGE_SIZE;

    if (!valid) {
      return yield* contentSitemapError(
        "CONTENT_SITEMAP_PAGE_INTEGRITY",
        `Content sitemap artifact ${args.locale}/${args.section}/${expectedPage} is invalid.`
      );
    }

    routes.push(
      ...page.routes.map((route) => ({
        date: route.date,
        kind: route.kind,
        route: route.route,
        section: route.section,
        syncedAt: route.syncedAt,
      }))
    );
  }

  if (
    pages.length !== expectedArtifactCount ||
    routes.length !== expectedRouteCount
  ) {
    return yield* contentSitemapError(
      "CONTENT_SITEMAP_PAGE_INTEGRITY",
      `Content sitemap page ${args.locale}/${args.section}/${args.page} is incomplete.`
    );
  }

  return { routes };
});

/** Reads the committed page count for one locale without scanning route rows. */
export const getPublicSitemapCountImpl = Effect.fn(
  "contents.publicSitemap.getCount"
)(function* (ctx: QueryCtx, args: GetPublicSitemapCountArgs) {
  const count = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapCounts")
      .withIndex("by_locale", (query) => query.eq("locale", args.locale))
      .unique()
  );

  if (!count) {
    return null;
  }

  if (!Number.isSafeInteger(count.count) || count.count < 0) {
    return yield* integrityError(
      `Public sitemap count for ${args.locale} is invalid.`
    );
  }

  const expectedPageCount = Math.ceil(count.count / PUBLIC_SITEMAP_PAGE_SIZE);

  if (
    !Number.isSafeInteger(count.pageCount) ||
    count.pageCount !== expectedPageCount
  ) {
    return yield* integrityError(
      `Public sitemap count for ${args.locale} has an invalid page count.`
    );
  }

  return {
    count: count.count,
    pageCount: count.pageCount,
  };
});

/** Reads one exact public sitemap page through persisted lexical boundaries. */
export const getPublicSitemapPageImpl = Effect.fn(
  "contents.publicSitemap.getPage"
)(function* (ctx: QueryCtx, args: GetPublicSitemapPageArgs) {
  if (!Number.isSafeInteger(args.page) || args.page < 0) {
    return yield* Effect.fail(
      new SitemapRuntimeError({
        code: "PUBLIC_SITEMAP_PAGE_INVALID",
        message: "Public sitemap page must be a non-negative integer.",
      })
    );
  }

  const count = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapCounts")
      .withIndex("by_locale", (query) => query.eq("locale", args.locale))
      .unique()
  );

  if (!count) {
    return null;
  }

  if (!Number.isSafeInteger(count.pageCount) || count.pageCount < 0) {
    return yield* integrityError(
      `Public sitemap page count for ${args.locale} is invalid.`
    );
  }

  if (args.page >= count.pageCount) {
    return null;
  }

  const page = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapPages")
      .withIndex("by_locale_and_page", (query) =>
        query.eq("locale", args.locale).eq("page", args.page)
      )
      .unique()
  );

  if (!page) {
    return yield* integrityError(
      `Public sitemap page ${args.locale}/${args.page} is missing from its committed count.`
    );
  }

  if (
    !Number.isSafeInteger(page.routeCount) ||
    page.routeCount < 1 ||
    page.routeCount > PUBLIC_SITEMAP_PAGE_SIZE
  ) {
    return yield* Effect.fail(
      new SitemapRuntimeError({
        code: "PUBLIC_SITEMAP_PAGE_OVERFLOW",
        message: `Public sitemap page ${args.locale}/${args.page} exceeds its safe route bound.`,
      })
    );
  }

  const routes = yield* Effect.promise(() =>
    ctx.db
      .query("publicRoutes")
      .withIndex("by_locale_and_sitemap_and_kind_and_publicPath", (query) =>
        query
          .eq("locale", args.locale)
          .eq("sitemap", true)
          .eq("kind", PUBLIC_SITEMAP_ROUTE_KIND)
          .gte("publicPath", page.startPath)
          .lte("publicPath", page.endPath)
      )
      .take(PUBLIC_SITEMAP_PAGE_SIZE + 1)
  );

  if (routes.length > PUBLIC_SITEMAP_PAGE_SIZE) {
    return yield* Effect.fail(
      new SitemapRuntimeError({
        code: "PUBLIC_SITEMAP_PAGE_OVERFLOW",
        message: `Public sitemap page ${args.locale}/${args.page} returned too many routes.`,
      })
    );
  }

  const firstPath = routes.at(0)?.publicPath;
  const lastPath = routes.at(-1)?.publicPath;
  const matchesBoundaries =
    firstPath === page.startPath && lastPath === page.endPath;

  if (routes.length !== page.routeCount || !matchesBoundaries) {
    return yield* integrityError(
      `Public sitemap page ${args.locale}/${args.page} does not match its committed boundaries.`
    );
  }

  return {
    paths: routes.map((route) => route.publicPath),
    syncedAt: page.syncedAt,
  };
});

/** Creates the typed integrity failure shared by count and page reads. */
function integrityError(message: string) {
  return Effect.fail(
    new SitemapRuntimeError({
      code: "PUBLIC_SITEMAP_PAGE_INTEGRITY",
      message,
    })
  );
}

/** Creates one typed content-sitemap runtime failure. */
function contentSitemapError(
  code:
    | "CONTENT_SITEMAP_PAGE_INTEGRITY"
    | "CONTENT_SITEMAP_PAGE_INVALID"
    | "CONTENT_SITEMAP_PAGE_OVERFLOW",
  message: string
) {
  return Effect.fail(new SitemapRuntimeError({ code, message }));
}
