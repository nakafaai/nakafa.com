import { CONTENT_SITEMAP_ROUTE_PAGE_SIZE } from "@repo/backend/convex/contents/sitemap/spec";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import { verifyMaterialReleasePin } from "@/lib/content/material/release";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";
import { readPublishedProgramBuckets } from "@/lib/content/program/sitemap";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import {
  getRuntimeContentRouteCounts,
  getRuntimePublicSitemapCount,
} from "@/lib/content/runtime/routes";
import { readPublishedTryoutSitemapCount } from "@/lib/content/tryout/sitemap";
import {
  formatArticlePage,
  formatContentPage,
  formatMaterialPage,
  formatProgramPage,
  formatPublicPage,
  formatTryoutPage,
  SITEMAP_BASE_ID,
  type SitemapPage,
} from "@/lib/sitemap/identity";

/** Reads sitemap page descriptors without loading route rows. */
export const readSitemapPageDescriptors = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors: SitemapPage[] = [{ id: SITEMAP_BASE_ID }];
  const active = yield* readActiveContentIdentity();
  const activeReleaseId = active?.releaseId ?? null;

  for (const locale of routing.locales) {
    const [
      articleBuckets,
      counts,
      materialBuckets,
      programBuckets,
      publicCount,
      tryoutCount,
    ] = yield* Effect.all(
      [
        readPublishedArticleBuckets(locale),
        getRuntimeContentRouteCounts({ locale }),
        readPublishedMaterialBuckets(locale, activeReleaseId),
        readPublishedProgramBuckets(locale),
        getRuntimePublicSitemapCount({ locale }),
        readPublishedTryoutSitemapCount(locale),
      ],
      { concurrency: "unbounded" }
    );

    if (publicCount) {
      for (let page = 0; page < publicCount.pageCount; page += 1) {
        descriptors.push({
          id: formatPublicPage(locale, page),
          kind: "public",
          locale,
          page,
        });
      }
    }

    for (const count of counts) {
      if (count.section === "articles") {
        continue;
      }
      if (count.section === "material") {
        continue;
      }
      if (count.section === "tryout") {
        continue;
      }
      const pageCount = Math.ceil(
        count.count / CONTENT_SITEMAP_ROUTE_PAGE_SIZE
      );
      for (let page = 0; page < pageCount; page += 1) {
        descriptors.push({
          id: formatContentPage(locale, count.section, page),
          kind: "content",
          locale,
          page,
          section: count.section,
        });
      }
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

  yield* verifyMaterialReleasePin(activeReleaseId, {
    locale: routing.defaultLocale,
    publicPath: "sitemap.xml",
  });

  return descriptors;
});
