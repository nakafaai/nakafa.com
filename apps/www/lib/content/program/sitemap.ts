import { HttpClient } from "@confect/js";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { httpLayer } from "@/lib/convex/http";

/** Reads non-empty curriculum sitemap partitions for one locale. */
export const readPublishedProgramBuckets = Effect.fn(
  "www.programs.readSitemapBuckets"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.program.sitemapBuckets, {
      appLocale,
    })
  ).pipe(Effect.provide(httpLayer()));
});

/** Reads one complete verified curriculum sitemap partition. */
export const readPublishedProgramSitemap = Effect.fn(
  "www.programs.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  const appLocale = AppLocaleSchema.make(locale);
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.program.sitemapPage, {
      appLocale,
      bucket,
    })
  ).pipe(Effect.provide(httpLayer()));
});
