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
