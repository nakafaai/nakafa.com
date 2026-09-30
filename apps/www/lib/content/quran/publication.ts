import { HttpClient } from "@confect/js";
import "server-only";
import { makeArtifactCacheTag } from "@nakafa/aksara-contracts/cache/content";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import { decodePublishedQuranSource } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranView } from "@repo/backend/client/quran/view";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import { cacheTag } from "next/cache";
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import { httpLayer } from "@/lib/convex/http";

/** Reads and validates the active signed Quran identity without a catalog payload. */
export const readPublishedQuranIdentity = Effect.fn(
  "NakafaQuran.readPublishedIdentity"
)(function* () {
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.quran.attribution, {})
  ).pipe(Effect.provide(httpLayer()));
  return yield* decodePublishedQuranSource(result, "attribution");
});

/** Reads and validates the active signed Quran metadata catalog. */
export const readPublishedQuranCatalog = Effect.fn(
  "NakafaQuran.readPublishedCatalog"
)(function* () {
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.quran.surahs, {})
  ).pipe(Effect.provide(httpLayer()));
  return yield* decodePublishedQuranCatalog(result);
});

/** Reads one complete signed Quran markdown projection. */
export const readPublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.readPublishedMarkdown"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(
      refs.public.contentRelease.quran.prose,
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

/** Reads one complete signed Quran web projection. */
const readPublishedQuranView = Effect.fn("NakafaQuran.readPublishedView")(
  function* (locale: Locale, surahNumber: number) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(refs.public.contentRelease.quran.page, {
        appLocale,
        surahNumber,
      })
    ).pipe(Effect.provide(httpLayer()));
    return yield* decodePublishedQuranView(result, {
      appLocale,
      surahNumber,
    });
  }
);

/** Caches the complete signed Quran metadata catalog by active release. */
export async function getPublishedQuranCatalog() {
  "use cache";

  const catalog = await Effect.runPromise(
    readPublishedQuranCatalog().pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("quran");
  cacheTag(makeArtifactCacheTag(catalog.snapshotId));
  return catalog;
}

/** Caches one narrow signed Quran web projection by locale and active release. */
export async function getPublishedQuranView(
  locale: Locale,
  surahNumber: number
) {
  "use cache";

  const view = await Effect.runPromise(
    readPublishedQuranView(locale, surahNumber).pipe(
      Effect.withTracerTiming(false)
    )
  );
  applyContentCache("quran");
  cacheTag(makeArtifactCacheTag(view.snapshotId));
  return view;
}
