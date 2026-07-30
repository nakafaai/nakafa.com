import { compareSitemapPaths } from "@repo/backend/convex/contents/sitemap/spec";
import { routing } from "@repo/internationalization/src/routing";
import { Data, Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedArticleSitemap } from "@/lib/content/article/sitemap";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";
import {
  getRuntimeContentSitemapPage,
  getRuntimePublicSitemapPage,
} from "@/lib/content/runtime/routes";
import { buildSitemapContentPageRoutes } from "@/lib/sitemap/content";
import {
  getSitemapPageDescriptor,
  isArticleSitemapPage,
  isContentSitemapPage,
  isMaterialSitemapPage,
  isProgramSitemapPage,
  isPublicSitemapPage,
} from "@/lib/sitemap/identity";
import {
  filterMaterialContentRows,
  filterMaterialPublicPaths,
} from "@/lib/sitemap/material";

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
      const [artifact, materialOwner, programOwner] = yield* Effect.all(
        [
          getRuntimePublicSitemapPage({
            locale: page.locale,
            page: page.page,
          }),
          readPublishedMaterialBuckets(page.locale),
          readPublishedProgramBuckets(page.locale),
        ],
        { concurrency: "unbounded" }
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      const visiblePaths = yield* filterMaterialPublicPaths(
        page.locale,
        artifact.paths,
        materialOwner.activeReleaseId
      );
      const routes: { lastModified: number; path: string }[] = [];
      for (const path of visiblePaths) {
        if (
          !isSourceOwnedPublicPath(path, page.locale, {
            material: materialOwner.managed,
            program: programOwner.managed,
          })
        ) {
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
      return yield* new SitemapPageNotFoundError({ pageId });
    }
    const visibleRoutes = yield* filterMaterialContentRows(
      page.locale,
      artifact.routes
    );
    return { routes: yield* buildSitemapContentPageRoutes(visibleRoutes) };
  }
);

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/** Keeps source-owned public paths only while their family is unmanaged. */
function isSourceOwnedPublicPath(
  path: string,
  locale: Locale,
  managed: { readonly material: boolean; readonly program: boolean }
) {
  const materialPattern =
    routing.pathnames["/materials/[subject]/[topic]/[[...lesson]]"][locale];
  const programPattern =
    routing.pathnames["/curricula/[curriculum]/[[...path]]"][locale];
  const materialPrefix = materialPattern.slice(1, materialPattern.indexOf("["));
  const programPrefix = programPattern.slice(1, programPattern.indexOf("["));
  if (managed.material && path.startsWith(materialPrefix)) {
    return false;
  }
  return !(managed.program && path.startsWith(programPrefix));
}
