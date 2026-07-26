import { CONTENT_SITEMAP_ROUTE_PAGE_SIZE } from "@repo/backend/convex/contents/sitemap/spec";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import {
  getRuntimeContentRouteCounts,
  getRuntimePublicSitemapCount,
} from "@/lib/content/runtime/routes";
import {
  formatArticlePage,
  formatContentPage,
  formatPublicPage,
  SITEMAP_BASE_ID,
  type SitemapPage,
} from "@/lib/sitemap/identity";

/** Reads sitemap page descriptors without loading route rows. */
export const readSitemapPageDescriptors = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors: SitemapPage[] = [{ id: SITEMAP_BASE_ID }];

  for (const locale of routing.locales) {
    const [articleBuckets, counts, publicCount] = yield* Effect.all(
      [
        readPublishedArticleBuckets(locale),
        getRuntimeContentRouteCounts({ locale }),
        getRuntimePublicSitemapCount({ locale }),
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
      if (count.section === "articles" && articleBuckets.managed) {
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
  }

  return descriptors;
});
