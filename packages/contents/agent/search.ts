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
 * Maximum length of one search query, in characters. Convex full-text search
 * reads the first 16 terms of an expression and drops the rest, and it drops
 * any term of 32 bytes or more, with no error for either (`MAX_QUERY_TERMS` and
 * `MAX_TEXT_TERM_LENGTH` in convex-backend crates/search, and
 * https://docs.convex.dev/search/text-search, which says characters where the
 * tokenizer filter counts UTF-8 bytes). 16 terms of 31 bytes with one
 * character between each two take 511 characters, so that is the longest text
 * 16 such terms fill. The limit is a length, not a term count: Convex counts
 * the terms, and a query of 17 short words passes here and loses its last word
 * there. A longer query is invalid, like a fifth query. A search already
 * recorded keeps whatever query it ran with.
 */
export const NAKAFA_AGENT_MAX_QUERY_LENGTH = 16 * 31 + 15;
