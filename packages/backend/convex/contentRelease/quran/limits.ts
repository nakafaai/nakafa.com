import { QURAN_CHUNK_SIZE } from "@nakafa/aksara-contracts/quran/spec";

/** Defensive verse ceiling for one complete Quran page transaction. */
export const QURAN_PAGE_VERSE_LIMIT = 300;

/** Maximum immutable chunk rows read for one complete Quran page. */
export const QURAN_PAGE_CHUNK_LIMIT = Math.ceil(
  QURAN_PAGE_VERSE_LIMIT / QURAN_CHUNK_SIZE
);

/** Maximum verses returned by one agent or API reference lookup. */
export const QURAN_REFERENCE_VERSE_LIMIT = 50;

/** Maximum localized rows returned by one full-text search request. */
export const QURAN_SEARCH_RESULT_LIMIT = 20;

/** Convex full-text search accepts at most sixteen query terms. */
export const QURAN_SEARCH_TERM_LIMIT = 16;

/** Convex full-text search accepts at most 32 UTF-8 bytes per term. */
export const QURAN_SEARCH_TERM_BYTE_LIMIT = 32;

/** Prevents one search argument from consuming an excessive request budget. */
export const QURAN_SEARCH_CHARACTER_LIMIT = 256;
