/** Default number of results returned by one agent search request. */
export const NAKAFA_AGENT_DEFAULT_LIMIT = 20;

/**
 * Maximum candidate window for one bounded search transaction.
 *
 * The published read model authenticates every candidate against its active
 * head and binding, so this cap leaves room below Convex transaction limits.
 */
export const NAKAFA_AGENT_SEARCH_WINDOW = 32;

/** Maximum number of results returned by one agent search request. */
export const NAKAFA_AGENT_MAX_LIMIT = NAKAFA_AGENT_SEARCH_WINDOW;

/** Maximum offset that can still address one item inside the search window. */
export const NAKAFA_AGENT_MAX_OFFSET = NAKAFA_AGENT_SEARCH_WINDOW - 1;

/** Maximum number of alternate query variants in one search request. */
export const NAKAFA_AGENT_MAX_QUERIES = 4;
