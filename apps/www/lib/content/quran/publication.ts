import "server-only";

import {
  decodePublishedQuranCatalog,
  decodePublishedQuranPage,
} from "@repo/backend/client/quran/decode";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads the raw signed Quran catalog through the public Convex query. */
function fetchCatalogResult() {
  return fetchRuntimeQuery(api.contentRelease.quran.surahs, {});
}

/** Reads one raw signed Quran page through the public Convex query. */
function fetchPageResult(locale: Locale, surahNumber: number) {
  return fetchRuntimeQuery(api.contentRelease.quran.page, {
    locale,
    surahNumber,
  });
}

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

/** Reads and validates one complete active signed Quran page. */
export const readPublishedQuranPage = Effect.fn(
  "NakafaQuran.readPublishedPage"
)(function* (locale: Locale, surahNumber: number) {
  const result = yield* readRuntimeQuery("contentRelease.quran.page", () =>
    fetchPageResult(locale, surahNumber)
  );
  return yield* decodePublishedQuranPage(result, { locale, surahNumber });
});

/** Caches the complete signed Quran metadata catalog by active release. */
export async function getPublishedQuranCatalog() {
  "use cache";

  const result = await fetchCatalogResult();
  const catalog = await Effect.runPromise(decodePublishedQuranCatalog(result));
  applyContentRuntimeCache();
  return catalog;
}

/** Caches one complete signed Quran page by locale and active release. */
export async function getPublishedQuranPage(
  locale: Locale,
  surahNumber: number
) {
  "use cache";

  const result = await fetchPageResult(locale, surahNumber);
  const page = await Effect.runPromise(
    decodePublishedQuranPage(result, { locale, surahNumber })
  );
  applyContentRuntimeCache();
  return page;
}
