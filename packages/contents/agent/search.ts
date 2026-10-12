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
 * reads up to 16 terms of fewer than 32 bytes from one search expression
 * (https://docs.convex.dev/search/text-search), so a query holds no more than
 * 16 terms of 31 characters with a space between each two: 511 characters. A
 * longer one is invalid, like a fifth query. A search already recorded keeps
 * whatever query it ran with.
 */
export const NAKAFA_AGENT_MAX_QUERY_LENGTH = 16 * 31 + 15;
