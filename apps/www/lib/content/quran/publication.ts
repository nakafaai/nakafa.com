import "server-only";

import {
  decodePublishedQuranCatalog,
  decodePublishedQuranSource,
} from "@repo/backend/client/quran/decode";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
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

/** Reads and validates one active signed Quran markdown projection. */
export const readPublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.readPublishedMarkdown"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  const result = yield* readRuntimeQuery(
    api.contentRelease.quran.markdown,
    verseLimit === undefined
      ? { locale, surahNumber }
      : { locale, surahNumber, verseLimit }
  );
  return yield* decodePublishedQuranMarkdown(result, {
    locale,
    surahNumber,
    verseLimit,
  });
});

/** Reads and validates one locale-specific signed Quran web projection. */
const readPublishedQuranView = Effect.fn("NakafaQuran.readPublishedView")(
  function* (locale: Locale, surahNumber: number) {
    const result = yield* readRuntimeQuery(api.contentRelease.quran.view, {
      locale,
      surahNumber,
    });
    return yield* decodePublishedQuranView(result, { locale, surahNumber });
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
