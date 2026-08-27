import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import { decodePublishedQuranSource } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranView } from "@repo/backend/client/quran/view";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedSnapshotCache } from "@/lib/content/cache";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads and validates the active signed Quran identity without a catalog payload. */
export const readPublishedQuranIdentity = Effect.fn(
  "NakafaQuran.readPublishedIdentity"
)(function* () {
  const result = yield* readRuntimeQuery(
    api.contentRelease.quran.attribution,
    {}
  );
  return yield* decodePublishedQuranSource(result, "attribution");
});

/** Reads and validates the active signed Quran metadata catalog. */
export const readPublishedQuranCatalog = Effect.fn(
  "NakafaQuran.readPublishedCatalog"
)(function* () {
  const result = yield* readRuntimeQuery(api.contentRelease.quran.surahs, {});
  return yield* decodePublishedQuranCatalog(result);
});

/** Reads one complete signed Quran markdown projection. */
export const readPublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.readPublishedMarkdown"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(
    api.contentRelease.quran.prose,
    verseLimit === undefined
      ? { appLocale, surahNumber }
      : { appLocale, surahNumber, verseLimit }
  );
  return yield* decodePublishedQuranMarkdown(result, {
    appLocale,
    surahNumber,
    verseLimit,
  });
});

/** Reads one complete signed Quran web projection. */
const readPublishedQuranView = Effect.fn("NakafaQuran.readPublishedView")(
  function* (locale: Locale, surahNumber: number) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* readRuntimeQuery(api.contentRelease.quran.page, {
      appLocale,
      surahNumber,
    });
    return yield* decodePublishedQuranView(result, {
      appLocale,
      surahNumber,
    });
  }
);

/** Caches the complete signed Quran metadata catalog by active release. */
export async function getPublishedQuranCatalog() {
  "use cache";

  const catalog = await Effect.runPromise(readPublishedQuranCatalog());
  applyPublishedSnapshotCache(catalog.snapshotId);
  return catalog;
}

/** Caches one narrow signed Quran web projection by locale and active release. */
export async function getPublishedQuranView(
  locale: Locale,
  surahNumber: number
) {
  "use cache";

  const view = await Effect.runPromise(
    readPublishedQuranView(locale, surahNumber)
  );
  applyPublishedSnapshotCache(view.snapshotId);
  return view;
}
