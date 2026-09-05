import {
  readTryoutSitemapCount,
  readTryoutSitemapPage,
} from "@repo/backend/content/tryout/sitemap";
import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads the active signed try-out sitemap inventory for one locale. */
export const readPublishedTryoutSitemapCount = Effect.fn(
  "www.tryouts.readSitemapCount"
)(function* (locale: Locale) {
  return yield* readRuntimeQuery(
    api.contentRelease.tryout.sitemapCount,
    {
      appLocale: AppLocaleSchema.make(locale),
    },
    ({ appLocale }) => readTryoutSitemapCount(appLocale)
  );
});

/** Reads one exact bounded signed try-out sitemap page. */
export const readPublishedTryoutSitemap = Effect.fn(
  "www.tryouts.readSitemapPage"
)(function* (locale: Locale, page: number) {
  return yield* readRuntimeQuery(
    api.contentRelease.tryout.sitemapPage,
    {
      appLocale: AppLocaleSchema.make(locale),
      page,
    },
    ({ appLocale, page }) => readTryoutSitemapPage(appLocale, page)
  );
});
