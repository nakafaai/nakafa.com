import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import { decodePublishedQuranSource } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranView } from "@repo/backend/client/quran/view";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { queryContentStore } from "@/lib/content/store/query";
import { httpLayer } from "@/lib/convex/http";

/** Reads and validates the active signed Quran identity without a catalog payload. */
export const readPublishedQuranIdentity = Effect.fn(
  "NakafaQuran.readPublishedIdentity"
)(function* () {
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.quran.attribution, {})
  ).pipe(Effect.provide(httpLayer()));
  return yield* decodePublishedQuranSource(result, "attribution");
});

/**
 * Reads and validates the active signed Quran metadata catalog. The content
 * store holds the query result once for each release, for the Quran pages and
 * the sitemap alike.
 */
export const readPublishedQuranCatalog = Effect.fn(
  "NakafaQuran.readPublishedCatalog"
)(function* () {
  const result = yield* queryContentStore(contentRelease.quran.surahs, {});
  return yield* decodePublishedQuranCatalog(result);
});

/** Reads one complete signed Quran markdown projection. */
export const readPublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.readPublishedMarkdown"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(
      contentRelease.quran.prose,
      verseLimit === undefined
        ? {
            appLocale,
            surahNumber,
          }
        : {
            appLocale,
            surahNumber,
            verseLimit,
          }
    )
  ).pipe(Effect.provide(httpLayer()));
  return yield* decodePublishedQuranMarkdown(result, {
    appLocale,
    surahNumber,
    ...(verseLimit === undefined
      ? {}
      : {
          verseLimit,
        }),
  });
});

/**
 * Reads one complete signed Quran web projection. The content store holds the
 * query result once for each release, locale and surah.
 */
const readPublishedQuranView = Effect.fn("NakafaQuran.readPublishedView")(
  function* (locale: Locale, surahNumber: number) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* queryContentStore(contentRelease.quran.page, {
      appLocale,
      surahNumber,
    });
    return yield* decodePublishedQuranView(result, {
      appLocale,
      surahNumber,
    });
  }
);

/**
 * Caches the complete signed Quran metadata catalog by active release. The `use
 * cache` boundary stays so that the Quran pages prerender and the Quran tag
 * still expires them.
 */
export async function getPublishedQuranCatalog() {
  const catalog = await Effect.runPromise(readPublishedQuranCatalog());
  return catalog;
}

/**
 * Reads one narrow signed Quran web projection by locale and active release.
 */
export async function getPublishedQuranView(
  locale: Locale,
  surahNumber: number
) {
  const view = await Effect.runPromise(
    readPublishedQuranView(locale, surahNumber)
  );
  return view;
}
