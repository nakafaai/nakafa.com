import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads non-empty article sitemap partitions for one localized catalog. */
export const readPublishedArticleBuckets = Effect.fn(
  "www.articles.readSitemapBuckets"
)(function* (locale: Locale) {
  const result = yield* readRuntimeQuery(
    api.contentRelease.article.sitemapBuckets,
    { locale }
  );
  if (!result.managed) {
    return yield* new PublishedProjectionError({
      locale,
      publicPath: "sitemap.xml",
    });
  }
  return {
    articleCount: result.articleCount,
    buckets: result.buckets,
  };
});

/** Reads one complete verified article sitemap partition. */
export const readPublishedArticleSitemap = Effect.fn(
  "www.articles.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  return yield* readRuntimeQuery(api.contentRelease.article.sitemapPage, {
    bucket,
    locale,
  });
});
