import { HttpClient } from "@confect/js";
import { env } from "@/env";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import type { Locale } from "next-intl";

/** Reads the active signed try-out sitemap inventory for one locale. */
export const readPublishedTryoutSitemapCount = Effect.fn(
  "www.tryouts.readSitemapCount"
)(function* (locale: Locale) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.tryout.sitemapCount, {
      appLocale: AppLocaleSchema.make(locale),
    })
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
});

/** Reads one exact bounded signed try-out sitemap page. */
export const readPublishedTryoutSitemap = Effect.fn(
  "www.tryouts.readSitemapPage"
)(function* (locale: Locale, page: number) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.tryout.sitemapPage, {
      appLocale: AppLocaleSchema.make(locale),
      page,
    })
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
});
