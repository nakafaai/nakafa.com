/**
 * Maximum authenticated candidate window for one bounded search transaction.
 *
 * Every search family shares the transaction-proven Quran ceiling so the
 * public pagination contract cannot address results a signed reader cannot
 * authenticate.
 */
export const NAKAFA_AGENT_SEARCH_WINDOW = 10;

/** Default number of results returned by one agent search request. */
export const NAKAFA_AGENT_DEFAULT_LIMIT = NAKAFA_AGENT_SEARCH_WINDOW;

/** Maximum number of results returned by one agent search request. */
export const NAKAFA_AGENT_MAX_LIMIT = NAKAFA_AGENT_SEARCH_WINDOW;

/** Maximum offset that can still address one item inside the search window. */
export const NAKAFA_AGENT_MAX_OFFSET = NAKAFA_AGENT_SEARCH_WINDOW - 1;

/** Maximum number of alternate query variants in one search request. */
export const NAKAFA_AGENT_MAX_QUERIES = 4;

/**
 * How many terms Convex full-text search reads from one search expression. It
 * keeps the first 16 and drops the rest without an error: `MAX_QUERY_TERMS` in
 * crates/search/src/constants.rs of get-convex/convex-backend, applied where a
 * query is compiled in crates/search/src/lib.rs (read on 13 October 2026). The
 * limits page gives the same number, "Terms per search query", at
 * https://docs.convex.dev/production/state/limits.
 */
const CONVEX_SEARCH_TERMS = 16;

/**
 * The size at which Convex full-text search drops a term, in UTF-8 bytes. A
 * term of this size or more is dropped without an error, so 31 bytes is the
 * longest term it keeps: `MAX_TEXT_TERM_LENGTH` in the same constants.rs feeds
 * the `RemoveLongFilter` of the Tantivy revision Convex pins, which counts
 * bytes and keeps a term only when it is shorter than the limit. The limits
 * page says "Maximum term length" is 32 B, and the text search page says 32
 * characters, which is the same for ASCII only.
 */
const CONVEX_SEARCH_TERM_BYTES = 32;

/**
 * Maximum length of one search query, in characters. Convex accepts a longer
 * one and reads only its first terms, so this bound is Nakafa's own: the
 * longest text that 16 terms of 31 bytes fill with one character between each
 * two, 511 characters. A query longer than that is invalid, like a fifth
 * query. The limit is a length, not a count of terms: Convex counts the terms,
 * and a query of 17 short words passes here and loses its last word there. A
 * search already recorded keeps whatever query it ran with.
 */
export const NAKAFA_AGENT_MAX_QUERY_LENGTH =
  CONVEX_SEARCH_TERMS * (CONVEX_SEARCH_TERM_BYTES - 1) +
  (CONVEX_SEARCH_TERMS - 1);
