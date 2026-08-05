import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  QURAN_CHUNK_DOCUMENT_LIMIT,
  QURAN_PAGE_CHUNK_LIMIT,
  QURAN_SEARCH_DOCUMENT_LIMIT,
  QURAN_SEARCH_DOCUMENT_READ_LIMIT,
  QURAN_SURAH_DOCUMENT_LIMIT,
  quranRowDocumentLimit,
} from "@repo/backend/convex/contentRelease/quran/limits";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { describe, expect, it } from "vitest";

const readBudget = TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM;

describe("contentRelease/quran/limits", () => {
  it("bounds catalog, page, and search reads below one transaction budget", () => {
    const catalogBytes = (QURAN_SURAH_COUNT + 1) * QURAN_SURAH_DOCUMENT_LIMIT;
    const pageBytes =
      (QURAN_PAGE_CHUNK_LIMIT + 1) * QURAN_CHUNK_DOCUMENT_LIMIT +
      3 * QURAN_SURAH_DOCUMENT_LIMIT +
      QURAN_SEARCH_DOCUMENT_LIMIT;
    const searchBytes =
      QURAN_SEARCH_DOCUMENT_READ_LIMIT * QURAN_SEARCH_DOCUMENT_LIMIT;

    expect(catalogBytes).toBeLessThanOrEqual(readBudget);
    expect(pageBytes).toBeLessThanOrEqual(readBudget);
    expect(searchBytes).toBeLessThanOrEqual(readBudget);
  });

  it("selects the exact ceiling for every Quran row kind", () => {
    expect(quranRowDocumentLimit("quran-attribution")).toBe(
      CONTENT_DOCUMENT_LIMIT
    );
    expect(quranRowDocumentLimit("quran-surah")).toBe(
      QURAN_SURAH_DOCUMENT_LIMIT
    );
    expect(quranRowDocumentLimit("quran-chunk")).toBe(
      QURAN_CHUNK_DOCUMENT_LIMIT
    );
    expect(quranRowDocumentLimit("quran-search")).toBe(
      QURAN_SEARCH_DOCUMENT_LIMIT
    );
  });
});
