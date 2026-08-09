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
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads the raw active Quran attribution through the public Convex query. */
function fetchAttributionResult() {
  return fetchRuntimeQuery(api.contentRelease.quran.attribution, {});
}

/** Reads the raw signed Quran catalog through the public Convex query. */
function fetchCatalogResult() {
  return fetchRuntimeQuery(api.contentRelease.quran.surahs, {});
}

/** Reads one raw signed Quran markdown projection through the public query. */
function fetchMarkdownResult(
  locale: Locale,
  surahNumber: number,
  verseLimit?: number
) {
  if (verseLimit === undefined) {
    return fetchRuntimeQuery(api.contentRelease.quran.markdown, {
      locale,
      surahNumber,
    });
  }
  return fetchRuntimeQuery(api.contentRelease.quran.markdown, {
    locale,
    surahNumber,
    verseLimit,
  });
}

/** Reads one locale-specific Quran web projection through the public query. */
function fetchViewResult(locale: Locale, surahNumber: number) {
  return fetchRuntimeQuery(api.contentRelease.quran.view, {
    locale,
    surahNumber,
  });
}

/** Reads and validates the active signed Quran identity without a catalog payload. */
export const readPublishedQuranIdentity = Effect.fn(
  "NakafaQuran.readPublishedIdentity"
)(function* () {
  const result = yield* readRuntimeQuery(
    "contentRelease.quran.attribution",
    fetchAttributionResult
  );
  return yield* decodePublishedQuranSource(result, "attribution");
});

/** Reads and validates the active signed Quran metadata catalog. */
export const readPublishedQuranCatalog = Effect.fn(
  "NakafaQuran.readPublishedCatalog"
)(function* () {
  const result = yield* readRuntimeQuery(
    "contentRelease.quran.surahs",
    fetchCatalogResult
  );
  return yield* decodePublishedQuranCatalog(result);
});

/** Reads and validates one active signed Quran markdown projection. */
export const readPublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.readPublishedMarkdown"
)(function* (locale: Locale, surahNumber: number, verseLimit?: number) {
  const result = yield* readRuntimeQuery("contentRelease.quran.markdown", () =>
    fetchMarkdownResult(locale, surahNumber, verseLimit)
  );
  return yield* decodePublishedQuranMarkdown(result, {
    locale,
    surahNumber,
    verseLimit,
  });
});

/** Caches the complete signed Quran metadata catalog by active release. */
export async function getPublishedQuranCatalog() {
  "use cache";

  const result = await fetchCatalogResult();
  const catalog = await Effect.runPromise(decodePublishedQuranCatalog(result));
  applyPublishedSnapshotCache(catalog.snapshotId);
  return catalog;
}

/** Caches one narrow signed Quran web projection by locale and active release. */
export async function getPublishedQuranView(
  locale: Locale,
  surahNumber: number
) {
  "use cache";

  const result = await fetchViewResult(locale, surahNumber);
  const view = await Effect.runPromise(
    decodePublishedQuranView(result, { locale, surahNumber })
  );
  applyPublishedSnapshotCache(view.snapshotId);
  return view;
}
