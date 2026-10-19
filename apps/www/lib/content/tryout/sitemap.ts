import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { queryContentStore } from "@/lib/content/store/query";

/** Reads the active signed try-out sitemap inventory for one locale. */
export const readPublishedTryoutSitemapCount = Effect.fn(
  "www.tryouts.readSitemapCount"
)(function* (locale: Locale) {
  return yield* queryContentStore(contentRelease.tryout.sitemapCount, {
    appLocale: AppLocaleSchema.make(locale),
  });
});

/** Reads one exact bounded signed try-out sitemap page. */
export const readPublishedTryoutSitemap = Effect.fn(
  "www.tryouts.readSitemapPage"
)(function* (locale: Locale, page: number) {
  return yield* queryContentStore(contentRelease.tryout.sitemapPage, {
    appLocale: AppLocaleSchema.make(locale),
    page,
  });
});
