/**
 * Maximum authenticated candidate window for one bounded public search.
 * Individual signed families may enforce a lower integrity-proven ceiling.
 */
export const NAKAFA_AGENT_SEARCH_WINDOW = 50;

/** Default number of results returned by one agent search request. */
export const NAKAFA_AGENT_DEFAULT_LIMIT = 10;

/** Maximum number of results returned by one agent search request. */
export const NAKAFA_AGENT_MAX_LIMIT = NAKAFA_AGENT_SEARCH_WINDOW;

/** Maximum offset that can still address one item inside the search window. */
export const NAKAFA_AGENT_MAX_OFFSET = NAKAFA_AGENT_SEARCH_WINDOW - 1;

/** Maximum number of alternate query variants in one search request. */
export const NAKAFA_AGENT_MAX_QUERIES = 4;
