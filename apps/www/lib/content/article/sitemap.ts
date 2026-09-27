import { HttpClient } from "@confect/js";
import { env } from "@/env";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";

/** Reads non-empty article sitemap partitions for one localized catalog. */
export const readPublishedArticleBuckets = Effect.fn(
  "www.articles.readSitemapBuckets"
)(function* (locale: Locale, expectedActiveReleaseId?: ContentReleasePin) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.article.sitemapBuckets, {
      appLocale,
    })
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
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
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.article.sitemapPage, {
      appLocale,
      bucket,
    })
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
});
