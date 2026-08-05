import { compareSitemapPaths } from "@repo/backend/convex/contents/sitemap/spec";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Data, Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedArticleSitemap } from "@/lib/content/article/sitemap";
import { readPublishedMaterialSitemap } from "@/lib/content/material/sitemap";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";
import {
  getRuntimeContentSitemapPage,
  getRuntimePublicSitemapPage,
} from "@/lib/content/runtime/routes";
import { readPublishedTryoutSitemap } from "@/lib/content/tryout/sitemap";
import { buildSitemapContentPageRoutes } from "@/lib/sitemap/content";
import {
  getSitemapPageDescriptor,
  isArticleSitemapPage,
  isContentSitemapPage,
  isMaterialSitemapPage,
  isProgramSitemapPage,
  isPublicSitemapPage,
  isTryoutSitemapPage,
} from "@/lib/sitemap/identity";

const quranRootRoute = "/quran";

/** A canonical sitemap page id whose route page does not exist. */
export class SitemapPageNotFoundError extends Data.TaggedError(
  "SitemapPageNotFoundError"
)<{
  readonly pageId: string;
}> {}

/** Static top-level routes in canonical lexical order. */
export const baseRoutes: readonly string[] = [
  "/",
  "/contributor",
  "/curricula",
  "/privacy-policy",
  quranRootRoute,
  "/search",
  "/security-policy",
  "/terms-of-service",
];

/** Reads the bounded routes and shared metadata for one sitemap page. */
export const readSitemapRoutePage = Effect.fn("www.sitemap.routePage")(
  function* (pageId: string) {
    const page = getSitemapPageDescriptor(pageId);
    if (!page) {
      return yield* new SitemapPageNotFoundError({ pageId });
    }

    if (isPublicSitemapPage(page)) {
      const [artifact, programOwner] = yield* Effect.all(
        [
          getRuntimePublicSitemapPage({
            locale: page.locale,
            page: page.page,
          }),
          readPublishedProgramBuckets(page.locale),
        ],
        { concurrency: "unbounded" }
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      const routes: { lastModified: number; path: string }[] = [];
      for (const path of artifact.paths) {
        if (!isRetainedPublicPath(path, page.locale, programOwner.managed)) {
          continue;
        }
        routes.push({
          lastModified: artifact.syncedAt,
          path: routeToPath(path),
        });
      }
      return {
        routes,
      };
    }

    if (isArticleSitemapPage(page)) {
      const artifact = yield* readPublishedArticleSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.routes
          .map(({ date, publicPath }) => ({
            lastModified:
              date === null ? undefined : Date.parse(`${date}T00:00:00.000Z`),
            path: routeToPath(publicPath),
          }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }
    if (isMaterialSitemapPage(page)) {
      const artifact = yield* readPublishedMaterialSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.routes
          .map(({ date, publicPath }) => ({
            lastModified: Date.parse(`${date}T00:00:00.000Z`),
            path: routeToPath(publicPath),
          }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }
    if (isProgramSitemapPage(page)) {
      const artifact = yield* readPublishedProgramSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.routes
          .map(({ publicPath }) => ({
            lastModified: undefined,
            path: routeToPath(publicPath),
          }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }

    if (isTryoutSitemapPage(page)) {
      const artifact = yield* readPublishedTryoutSitemap(
        page.locale,
        page.page
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.paths
          .map((publicPath) => ({
            lastModified: undefined,
            path: routeToPath(publicPath),
          }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }

    if (!isContentSitemapPage(page)) {
      return {
        routes: baseRoutes.map((path) => ({ lastModified: undefined, path })),
      };
    }

    if (page.section === "tryout") {
      return yield* new SitemapPageNotFoundError({ pageId });
    }
    if (page.section === "articles" || page.section === "material") {
      return yield* new SitemapPageNotFoundError({ pageId });
    }
    const artifact = yield* getRuntimeContentSitemapPage({
      locale: page.locale,
      page: page.page,
      section: page.section,
    });
    if (!artifact) {
      return yield* new SitemapPageNotFoundError({ pageId });
    }
    return { routes: yield* buildSitemapContentPageRoutes(artifact.routes) };
  }
);

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/** Keeps only paths whose family still uses the local runtime projection. */
function isRetainedPublicPath(
  path: string,
  locale: Locale,
  programManaged: boolean
) {
  for (const surface of PUBLIC_ROUTE_SURFACES) {
    if (surface.key === "curriculum" && !programManaged) {
      continue;
    }
    if (path.startsWith(`${surface.routeSlugs[locale]}/`)) {
      return false;
    }
  }
  return true;
}
