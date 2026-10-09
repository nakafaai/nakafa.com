import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { MATERIAL_SITEMAP_BUCKET_LIMIT } from "@repo/backend/confect/contentRelease/material/limits";
import { compareSitemapPaths } from "@repo/backend/confect/contentRelease/sitemap";
import { Array as Arr, Effect } from "effect";
import type { Locale } from "next-intl";
import {
  readPublishedArticleBuckets,
  readPublishedArticleSitemap,
} from "@/lib/content/article/sitemap";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { verifyContentReleasePin } from "@/lib/content/published/release";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { readPublishedTryoutSitemap } from "@/lib/content/tryout/sitemap";
import {
  getSitemapPageDescriptor,
  isArticleSitemapPage,
  isMaterialSitemapPage,
  isPageSitemapPage,
  isProgramSitemapPage,
  isQuranSitemapPage,
  isTryoutSitemapPage,
  type SitemapFamilyPage,
  SitemapPageNotFoundError,
} from "@/lib/sitemap/identity";
import { selectSitemapPartition } from "@/lib/sitemap/partition";

const quranRootRoute = "/quran";

/** Bucket inventories backing capacity-owned sitemap partitions. */
const familyBucketInventories = {
  article: readPublishedArticleBuckets,
  material: readPublishedMaterialBuckets,
  program: readPublishedProgramBuckets,
} as const;

/** Bucket sitemap pages backing partition fan-out reads. */
const familyBucketPages = {
  article: readPublishedArticleSitemap,
  program: readPublishedProgramSitemap,
} as const;

/** Static top-level routes in canonical lexical order. */
export const baseRoutes: readonly string[] = [
  "/",
  "/contributor",
  "/curricula",
  "/pricing",
  quranRootRoute,
  "/search",
];

/** Reads the bounded routes and shared metadata for one sitemap page. */
export const readSitemapRoutePage = Effect.fn("www.sitemap.routePage")(
  function* (pageId: string) {
    const page = getSitemapPageDescriptor(pageId);
    if (!page) {
      return yield* new SitemapPageNotFoundError({ pageId });
    }

    if (
      isArticleSitemapPage(page) ||
      isMaterialSitemapPage(page) ||
      isProgramSitemapPage(page)
    ) {
      return yield* readFamilyPartition(
        pageId,
        page.kind,
        page.locale,
        page.partition
      );
    }

    if (isTryoutSitemapPage(page)) {
      const { missing } = yield* pinSitemapRelease(pageId, page.locale);
      const artifact = yield* readPublishedTryoutSitemap(
        page.locale,
        page.page
      );
      if (!artifact) {
        return yield* missing;
      }
      const artifactRoutes = Arr.map(artifact.paths, (publicPath) => ({
        path: routeToPath(publicPath),
      }));
      return {
        routes: Arr.sortWith(
          artifactRoutes,
          (route) => route.path,
          compareSitemapPaths
        ),
      };
    }

    if (isPageSitemapPage(page)) {
      const { missing } = yield* pinSitemapRelease(pageId, page.locale);
      const catalog = yield* readPublishedPageCatalog();
      const projections = Arr.filter(
        catalog.projections,
        (projection) => projection.appLocale === page.locale
      );
      if (projections.length === 0) {
        return yield* missing;
      }
      const projectionRoutes = Arr.map(projections, (projection) => ({
        lastModified:
          projection.metadata.dateModified ?? projection.metadata.datePublished,
        path: routeToPath(projection.publicPath),
      }));
      const routes = Arr.sortWith(
        projectionRoutes,
        (route) => route.path,
        compareSitemapPaths
      );
      return {
        routes,
      };
    }

    if (isQuranSitemapPage(page)) {
      const { surahs } = yield* readPublishedQuranCatalog();
      return {
        routes: Arr.map(surahs, (surah) => ({
          path: `/quran/${surah.number}`,
        })),
      };
    }

    return {
      routes: Arr.map(baseRoutes, (path) => ({ path })),
    };
  }
);

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/** Maps one family sitemap route into a canonical path entry. */
function mapFamilyRoute(route: {
  readonly lastModified?: string;
  readonly publicPath: string;
}) {
  return {
    ...("lastModified" in route && route.lastModified !== undefined
      ? { lastModified: route.lastModified }
      : {}),
    path: routeToPath(route.publicPath),
  };
}

/**
 * Pins the active release for one sitemap page read.
 *
 * `verify` fails once another release is active. `missing` reports the page as
 * missing only while the pinned release is still the active one: a missing
 * page is cached behind the long origin-cache lifetime, so a page the landing
 * publication just added must fail the read instead of being cached as
 * missing.
 */
const pinSitemapRelease = Effect.fn("www.sitemap.routePage.pin")(function* (
  pageId: string,
  locale: Locale
) {
  const identity = {
    appLocale: AppLocaleSchema.make(locale),
    publicPath: `sitemap/${pageId}.xml`,
  };
  const active = yield* readActiveContentIdentity();
  if (!active) {
    return yield* PublishedProjectionError.make(identity);
  }
  const verify = verifyContentReleasePin(active.releaseId, identity);
  return {
    identity,
    missing: verify.pipe(
      Effect.andThen(new SitemapPageNotFoundError({ pageId }))
    ),
    verify,
  };
});

/** Reads one capacity-owned family partition across its bucket group.
 *
 * Pins the active release before the fan-out and re-verifies it after, so a
 * publication that lands mid-render fails loudly instead of caching a mixed
 * or partial partition behind the long origin-cache lifetime. */
const readFamilyPartition = Effect.fn("www.sitemap.routePage.partition")(
  function* (
    pageId: string,
    family: SitemapFamilyPage["kind"],
    locale: Locale,
    partition: number
  ) {
    const { identity, missing, verify } = yield* pinSitemapRelease(
      pageId,
      locale
    );
    const inventory = yield* familyBucketInventories[family](locale);
    const buckets = selectSitemapPartition(inventory.buckets, partition);
    if (buckets.length === 0) {
      return yield* missing;
    }
    const pages =
      family === "material"
        ? yield* Effect.forEach(
            Arr.chunksOf(buckets, MATERIAL_SITEMAP_BUCKET_LIMIT),
            (batch) => readPublishedMaterialSitemap(locale, batch),
            { concurrency: 2 }
          )
        : yield* Effect.forEach(
            buckets,
            (bucket) => familyBucketPages[family](locale, bucket),
            { concurrency: 4 }
          );
    const pageRoutes = yield* Effect.forEach(pages, (page) =>
      page === null
        ? Effect.fail(PublishedProjectionError.make(identity))
        : Effect.succeed(Arr.map(page.routes, mapFamilyRoute))
    );
    const routes = Arr.sortWith(
      Arr.flatten(pageRoutes),
      (route) => route.path,
      compareSitemapPaths
    );
    if (routes.length === 0) {
      return yield* missing;
    }
    yield* verify;
    return { routes };
  }
);
