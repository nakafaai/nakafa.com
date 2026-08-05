import {
  QURAN_CHUNK_SIZE,
  QURAN_SURAH_COUNT,
  type QuranSnapshotRow,
} from "@nakafa/aksara-contracts/quran/spec";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/_types/agent/search";

/** Defensive verse ceiling for one complete Quran page transaction. */
export const QURAN_PAGE_VERSE_LIMIT = 300;

/** Maximum immutable chunk rows read for one complete Quran page. */
export const QURAN_PAGE_CHUNK_LIMIT = Math.ceil(
  QURAN_PAGE_VERSE_LIMIT / QURAN_CHUNK_SIZE
);

/** Maximum verses returned by one agent or API reference lookup. */
export const QURAN_REFERENCE_VERSE_LIMIT = 50;

/** Maximum localized rows returned by one full-text search request. */
export const QURAN_SEARCH_RESULT_LIMIT = NAKAFA_AGENT_SEARCH_WINDOW;

/** Prevents one search argument from consuming an excessive request budget. */
export const QURAN_SEARCH_CHARACTER_LIMIT = 256;

const QURAN_READ_BUDGET = TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM;
const QURAN_CATALOG_SCAN_LIMIT = QURAN_SURAH_COUNT + 1;
const QURAN_PAGE_CHUNK_SCAN_LIMIT = QURAN_PAGE_CHUNK_LIMIT + 1;
const QURAN_PAGE_SURAH_READS = 3;

/** Total search projections and signed rows allowed in one search transaction. */
export const QURAN_SEARCH_DOCUMENT_READ_LIMIT = QURAN_SEARCH_RESULT_LIMIT * 3;

/** Per-row ceiling that keeps a complete surah catalog within read limits. */
export const QURAN_SURAH_DOCUMENT_LIMIT = Math.floor(
  QURAN_READ_BUDGET / QURAN_CATALOG_SCAN_LIMIT
);

/** Per-document ceiling for paired search projections and signed rows. */
export const QURAN_SEARCH_DOCUMENT_LIMIT = Math.floor(
  QURAN_READ_BUDGET / QURAN_SEARCH_DOCUMENT_READ_LIMIT
);

/** Per-chunk ceiling after reserving one page's metadata and search rows. */
export const QURAN_CHUNK_DOCUMENT_LIMIT = Math.floor(
  (QURAN_READ_BUDGET -
    QURAN_PAGE_SURAH_READS * QURAN_SURAH_DOCUMENT_LIMIT -
    QURAN_SEARCH_DOCUMENT_LIMIT) /
    QURAN_PAGE_CHUNK_SCAN_LIMIT
);

/** Selects the storage ceiling proven for one Quran runtime row kind. */
export function quranRowDocumentLimit(
  kind: QuranSnapshotRow["payload"]["kind"]
) {
  if (kind === "quran-surah") {
    return QURAN_SURAH_DOCUMENT_LIMIT;
  }
  if (kind === "quran-chunk") {
    return QURAN_CHUNK_DOCUMENT_LIMIT;
  }
  if (kind === "quran-search") {
    return QURAN_SEARCH_DOCUMENT_LIMIT;
  }
  return CONTENT_DOCUMENT_LIMIT;
}
