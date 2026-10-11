import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Effect, MutableList, Schema } from "effect";
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
import { readContentStore } from "@/lib/content/store/read";
import { readPublishedTryoutSitemapCount } from "@/lib/content/tryout/sitemap";
import { applySitemapCache } from "@/lib/sitemap/cache";
import {
  formatPagePage,
  formatQuranPage,
  formatTryoutPage,
  SITEMAP_BASE_ID,
  type SitemapPage,
  SitemapPageSchema,
} from "@/lib/sitemap/identity";
import { describeSitemapPartitions } from "@/lib/sitemap/partition";

/** Reads sitemap page descriptors without loading route rows. */
export const readSitemapPageDescriptors = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors = MutableList.make<SitemapPage>();
  MutableList.append(descriptors, { id: SITEMAP_BASE_ID });
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
      MutableList.append(descriptors, {
        id: formatQuranPage(locale),
        kind: "quran",
        locale,
      });
    }

    if (
      Arr.some(pageCatalog.projections, ({ appLocale }) => appLocale === locale)
    ) {
      MutableList.append(descriptors, {
        id: formatPagePage(locale),
        kind: "page",
        locale,
      });
    }

    MutableList.appendAll(descriptors, [
      ...describeSitemapPartitions("article", locale, articleBuckets.buckets),
      ...describeSitemapPartitions("material", locale, materialBuckets.buckets),
      ...describeSitemapPartitions("program", locale, programBuckets.buckets),
    ]);
    for (let page = 0; page < tryoutCount.pageCount; page += 1) {
      MutableList.append(descriptors, {
        id: formatTryoutPage(locale, page),
        kind: "tryout",
        locale,
        page,
      });
    }
  }

  yield* verifyContentReleasePin(activeReleaseId, identity);

  return MutableList.toArray(descriptors);
});

/** Reads sitemap page descriptors inside the sitemap origin cache.
 *
 * The `use cache` boundary stays so that the route still prerenders and the
 * sitemap tag still expires it. Descriptors keep the long built-in profile on
 * purpose: every release hard-expires them through the shared sitemap tag, so
 * the index never needs the hourly content revalidation the shared profile
 * carries. Behind the boundary the content store answers for the release, so
 * an instance that starts empty or an expiry rebuilds the index from Convex
 * only once for each release. */
async function readCachedSitemapDescriptors(): Promise<readonly SitemapPage[]> {
  "use cache";

  applySitemapCache();
  return await Effect.runPromise(
    readContentStore({
      kind: "sitemap.index",
      load: readSitemapPageDescriptors(),
      parts: [],
      schema: Schema.Array(SitemapPageSchema),
    })
  );
}

/** Shares one cached sitemap index between the route and indexing scripts
 * in a single render pass. https://react.dev/reference/react/cache */
export const getCachedSitemapDescriptors = cache(readCachedSitemapDescriptors);
