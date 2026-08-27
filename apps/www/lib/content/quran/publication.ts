import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  completePublishedQuranSurah,
  decodePublishedQuranCatalog,
} from "@repo/backend/client/quran/catalog";
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

/** Reads one Quran markdown projection and its predecessor-only catalog. */
const readPublishedQuranMarkdownAttempt = Effect.fn(
  "NakafaQuran.readPublishedMarkdownAttempt"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(
    api.contentRelease.quran.prose,
    verseLimit === undefined
      ? { appLocale, surahNumber }
      : { appLocale, surahNumber, verseLimit }
  );
  const markdown = yield* decodePublishedQuranMarkdown(result, {
    appLocale,
    surahNumber,
    verseLimit,
  });
  const catalog =
    markdown.surah.name.meaning === null
      ? yield* readPublishedQuranCatalog()
      : null;
  const surah = yield* completePublishedQuranSurah(markdown.surah, catalog, {
    operation: "markdown",
    snapshotId: markdown.snapshotId,
  });
  return { ...markdown, surah };
});

/** Retries only the release-switch race while predecessor reads remain live. */
export const readPublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.readPublishedMarkdown"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  return yield* readPublishedQuranMarkdownAttempt(
    locale,
    surahNumber,
    verseLimit
  ).pipe(
    Effect.retry({
      times: 2,
      while: (error) => error._tag === "QuranSnapshotChangedError",
    })
  );
});

/** Reads one Quran view projection and its predecessor-only catalog. */
const readPublishedQuranViewAttempt = Effect.fn(
  "NakafaQuran.readPublishedViewAttempt"
)(function* (locale: Locale, surahNumber: number) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(api.contentRelease.quran.page, {
    appLocale,
    surahNumber,
  });
  const view = yield* decodePublishedQuranView(result, {
    appLocale,
    surahNumber,
  });
  const needsCatalog = [view.surah, view.previousSurah, view.nextSurah].some(
    (surah) => surah?.name.meaning === null
  );
  const catalog = needsCatalog ? yield* readPublishedQuranCatalog() : null;
  const surah = yield* completePublishedQuranSurah(view.surah, catalog, {
    operation: "view",
    snapshotId: view.snapshotId,
  });
  const previousSurah =
    view.previousSurah === null
      ? null
      : yield* completePublishedQuranSurah(view.previousSurah, catalog, {
          operation: "view",
          snapshotId: view.snapshotId,
        });
  const nextSurah =
    view.nextSurah === null
      ? null
      : yield* completePublishedQuranSurah(view.nextSurah, catalog, {
          operation: "view",
          snapshotId: view.snapshotId,
        });
  return {
    ...view,
    nextSurah,
    previousSurah,
    surah,
  };
});

/** Reads one race-safe locale-specific signed Quran web projection. */
const readPublishedQuranView = Effect.fn("NakafaQuran.readPublishedView")(
  function* (locale: Locale, surahNumber: number) {
    return yield* readPublishedQuranViewAttempt(locale, surahNumber).pipe(
      Effect.retry({
        times: 2,
        while: (error) => error._tag === "QuranSnapshotChangedError",
      })
    );
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
