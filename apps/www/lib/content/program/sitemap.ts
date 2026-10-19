import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { queryContentStore } from "@/lib/content/store/query";

/** Reads non-empty curriculum sitemap partitions for one locale. */
export const readPublishedProgramBuckets = Effect.fn(
  "www.programs.readSitemapBuckets"
)(function* (locale: Locale) {
  return yield* queryContentStore(contentRelease.program.sitemapBuckets, {
    appLocale: AppLocaleSchema.make(locale),
  });
});

/** Reads one complete verified curriculum sitemap partition. */
export const readPublishedProgramSitemap = Effect.fn(
  "www.programs.readSitemapPage"
)(function* (locale: Locale, bucket: string) {
  return yield* queryContentStore(contentRelease.program.sitemapPage, {
    appLocale: AppLocaleSchema.make(locale),
    bucket,
  });
});
