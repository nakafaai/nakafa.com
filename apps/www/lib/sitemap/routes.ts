import { compareSitemapPaths } from "@repo/backend/convex/contents/sitemap/spec";
import { Data, Effect } from "effect";
import { readPublishedArticleSitemap } from "@/lib/content/article/sitemap";
import {
  getRuntimeContentSitemapPage,
  getRuntimePublicSitemapPage,
} from "@/lib/content/runtime/routes";
import { buildSitemapContentPageRoutes } from "@/lib/sitemap/content";
import {
  getSitemapPageDescriptor,
  isArticleSitemapPage,
  isContentSitemapPage,
  isPublicSitemapPage,
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
      return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
    }

    if (isPublicSitemapPage(page)) {
      const artifact = yield* getRuntimePublicSitemapPage({
        locale: page.locale,
        page: page.page,
      });
      if (!artifact) {
        return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
      }
      return {
        routes: artifact.paths.map((path) => ({
          lastModified: artifact.syncedAt,
          path: routeToPath(path),
        })),
      };
    }

    if (isArticleSitemapPage(page)) {
      const artifact = yield* readPublishedArticleSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
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

    if (!isContentSitemapPage(page)) {
      return {
        routes: baseRoutes.map((path) => ({ lastModified: undefined, path })),
      };
    }

    const artifact = yield* getRuntimeContentSitemapPage({
      locale: page.locale,
      page: page.page,
      section: page.section,
    });
    if (!artifact) {
      return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
    }
    return { routes: yield* buildSitemapContentPageRoutes(artifact.routes) };
  }
);

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}
