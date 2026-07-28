/** Default number of results returned by one agent search request. */
export const NAKAFA_AGENT_DEFAULT_LIMIT = 20;

/**
 * Maximum authenticated candidate window for one bounded search transaction.
 *
 * Raw indexes may prefilter several bounded groups, but the published read
 * model authenticates at most this many unique heads and bindings.
 */
export const NAKAFA_AGENT_SEARCH_WINDOW = 32;

/** Maximum number of results returned by one agent search request. */
export const NAKAFA_AGENT_MAX_LIMIT = NAKAFA_AGENT_SEARCH_WINDOW;

/** Maximum offset that can still address one item inside the search window. */
export const NAKAFA_AGENT_MAX_OFFSET = NAKAFA_AGENT_SEARCH_WINDOW - 1;

/** Maximum number of alternate query variants in one search request. */
export const NAKAFA_AGENT_MAX_QUERIES = 4;
