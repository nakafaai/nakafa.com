import { MATERIAL_SITEMAP_BUCKET_LIMIT } from "@repo/backend/confect/contentRelease/material/limits";
import { compareSitemapPaths } from "@repo/backend/confect/contentRelease/sitemap";
import { Array as Arr, Effect } from "effect";
import type { Locale } from "use-intl";
import {
  readPublishedArticleBuckets,
  readPublishedArticleSitemap,
} from "@/lib/content/article/sitemap";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import type { SitemapFamilyPage } from "@/lib/sitemap/identity";
import { selectSitemapPartition } from "@/lib/sitemap/partition";
import { pinSitemapRelease } from "@/lib/sitemap/pin";

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

/** Converts one route string into an app-level HTTP path string. */
export function routeToPath(route: string) {
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

/** Reads one capacity-owned family partition across its bucket group.
 *
 * Pins the active release before the fan-out and re-verifies it after, so a
 * publication that lands mid-render fails loudly instead of caching a mixed
 * or partial partition behind the long origin-cache lifetime. */
export const readFamilyPartition = Effect.fn("www.sitemap.routePage.partition")(
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
        ? Effect.fail(new PublishedProjectionError(identity))
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
