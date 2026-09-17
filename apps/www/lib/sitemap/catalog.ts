import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { cache } from "react";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { readPublishedProgramBuckets } from "@/lib/content/program/sitemap";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  decodeContentReleasePin,
  verifyContentReleasePin,
} from "@/lib/content/published/release";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { readPublishedTryoutSitemapCount } from "@/lib/content/tryout/sitemap";
import { applySitemapCache } from "@/lib/sitemap/cache";
import {
  formatPagePage,
  formatQuranPage,
  formatTryoutPage,
  SITEMAP_BASE_ID,
  type SitemapPage,
} from "@/lib/sitemap/identity";
import { describeSitemapPartitions } from "@/lib/sitemap/partition";

/** Reads sitemap page descriptors without loading route rows. */
export const readSitemapPageDescriptors = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors: SitemapPage[] = [{ id: SITEMAP_BASE_ID }];
  const identity = {
    appLocale: AppLocaleSchema.make(routing.defaultLocale),
    publicPath: "sitemap.xml",
  };
  const active = yield* readActiveContentIdentity();
  if (!active) {
    return yield* new PublishedProjectionError(identity);
  }
  const activeReleaseId = active.releaseId;
  const [pageCatalog, quranCatalog] = yield* Effect.all([
    readPublishedPageCatalog(),
    readPublishedQuranCatalog(),
  ]);
  yield* decodeContentReleasePin(
    pageCatalog.activeReleaseId,
    activeReleaseId,
    identity
  );
  yield* decodeContentReleasePin(
    quranCatalog.activeReleaseId,
    activeReleaseId,
    identity
  );

  for (const locale of routing.locales) {
    const [articleBuckets, materialBuckets, programBuckets, tryoutCount] =
      yield* Effect.all(
        [
          readPublishedArticleBuckets(locale, activeReleaseId),
          readPublishedMaterialBuckets(locale, activeReleaseId),
          readPublishedProgramBuckets(locale),
          readPublishedTryoutSitemapCount(locale),
        ],
        { concurrency: "unbounded" }
      );

    if (quranCatalog.surahs.length > 0) {
      descriptors.push({
        id: formatQuranPage(locale),
        kind: "quran",
        locale,
      });
    }

    if (pageCatalog.projections.some(({ appLocale }) => appLocale === locale)) {
      descriptors.push({
        id: formatPagePage(locale),
        kind: "page",
        locale,
      });
    }

    descriptors.push(
      ...describeSitemapPartitions("article", locale, articleBuckets.buckets),
      ...describeSitemapPartitions("material", locale, materialBuckets.buckets),
      ...describeSitemapPartitions("program", locale, programBuckets.buckets)
    );
    for (let page = 0; page < tryoutCount.pageCount; page += 1) {
      descriptors.push({
        id: formatTryoutPage(locale, page),
        kind: "tryout",
        locale,
        page,
      });
    }
  }

  yield* verifyContentReleasePin(activeReleaseId, identity);

  return descriptors;
});

/** Reads sitemap page descriptors inside the sitemap origin cache.
 *
 * Descriptors keep the long built-in profile on purpose. Every publication
 * hard-expires them through the shared sitemap tag, so the index never needs
 * the hourly content revalidation the shared profile carries. */
async function readCachedSitemapDescriptors(): Promise<readonly SitemapPage[]> {
  "use cache";

  applySitemapCache();
  return await Effect.runPromise(readSitemapPageDescriptors());
}

/** Shares one cached sitemap index between the route and indexing scripts
 * in a single render pass. https://react.dev/reference/react/cache */
export const getCachedSitemapDescriptors = cache(readCachedSitemapDescriptors);
