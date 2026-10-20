import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { queryContentStore } from "@/lib/content/store/query";

/** Reads non-empty article sitemap partitions for one localized catalog. */
export const readPublishedArticleBuckets = Effect.fn(
  "www.articles.readSitemapBuckets"
)(function* (locale: Locale, expectedActiveReleaseId?: ContentReleasePin) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryContentStore(
    contentRelease.article.sitemapBuckets,
    { appLocale }
  );
  const activeReleaseId = yield* decodeContentReleasePin(
    result.activeReleaseId,
    expectedActiveReleaseId,
    {
      appLocale,
      publicPath: "articles",
    }
  );
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "sitemap.xml",
    });
  }
  return {
    activeReleaseId,
    articleCount: result.articleCount,
    buckets: result.buckets,
  };
});

/** Reads one complete verified article sitemap partition. */
export const readPublishedArticleSitemap = Effect.fn(
  "www.articles.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* queryContentStore(contentRelease.article.sitemapPage, {
    appLocale,
    bucket,
  });
});
