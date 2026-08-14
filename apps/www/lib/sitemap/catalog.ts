import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";
import { readPublishedProgramBuckets } from "@/lib/content/program/sitemap";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  decodeContentReleasePin,
  verifyContentReleasePin,
} from "@/lib/content/published/release";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { readPublishedTryoutSitemapCount } from "@/lib/content/tryout/sitemap";
import {
  formatArticlePage,
  formatMaterialPage,
  formatProgramPage,
  formatQuranPage,
  formatTryoutPage,
  SITEMAP_BASE_ID,
  type SitemapPage,
} from "@/lib/sitemap/identity";

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
  const quranCatalog = yield* readPublishedQuranCatalog();
  yield* decodeContentReleasePin(
    quranCatalog.activeReleaseId,
    activeReleaseId,
    identity
  );

  for (const locale of routing.locales) {
    const [articleBuckets, materialBuckets, programBuckets, tryoutCount] =
      yield* Effect.all(
        [
          readPublishedArticleBuckets(locale),
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

    for (const bucket of articleBuckets.buckets) {
      descriptors.push({
        bucket,
        id: formatArticlePage(bucket, locale),
        kind: "article",
        locale,
      });
    }
    for (const bucket of materialBuckets.buckets) {
      descriptors.push({
        bucket,
        id: formatMaterialPage(bucket, locale),
        kind: "material",
        locale,
      });
    }
    for (const bucket of programBuckets.buckets) {
      descriptors.push({
        bucket,
        id: formatProgramPage(bucket, locale),
        kind: "program",
        locale,
      });
    }
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
