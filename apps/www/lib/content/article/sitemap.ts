import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads non-empty article sitemap partitions for one localized catalog. */
export const readPublishedArticleBuckets = Effect.fn(
  "www.articles.readSitemapBuckets"
)(function* (locale: Locale) {
  return yield* readRuntimeQuery("contentRelease.article.sitemapBuckets", () =>
    fetchRuntimeQuery(api.contentRelease.article.sitemapBuckets, { locale })
  );
});

/** Reads one complete verified article sitemap partition. */
export const readPublishedArticleSitemap = Effect.fn(
  "www.articles.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  return yield* readRuntimeQuery("contentRelease.article.sitemapPage", () =>
    fetchRuntimeQuery(api.contentRelease.article.sitemapPage, {
      bucket,
      locale,
    })
  );
});
