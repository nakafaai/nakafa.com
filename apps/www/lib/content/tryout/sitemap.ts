import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { env } from "@/env";
import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";

/** Reads the active signed try-out sitemap inventory for one locale. */
export const readPublishedTryoutSitemapCount = Effect.fn(
  "www.tryouts.readSitemapCount"
)(function* (locale: Locale) {
  return yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.contentRelease.tryout.sitemapCount,
    {
      appLocale: AppLocaleSchema.make(locale),
    }
  );
});

/** Reads one exact bounded signed try-out sitemap page. */
export const readPublishedTryoutSitemap = Effect.fn(
  "www.tryouts.readSitemapPage"
)(function* (locale: Locale, page: number) {
  return yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.contentRelease.tryout.sitemapPage,
    {
      appLocale: AppLocaleSchema.make(locale),
      page,
    }
  );
});
