/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_BASE_URL = "https://nakafa.com";

/** Recommended public Streamable HTTP MCP endpoint. */
export const NAKAFA_MCP_RECOMMENDED_ENDPOINT = "https://nakafa.com/mcp";

/** Direct MCP application endpoint for clients that prefer the subdomain. */
export const NAKAFA_MCP_DIRECT_ENDPOINT = "https://mcp.nakafa.com/mcp";

/** Informational subdomain root; this is not a transport endpoint. */
export const NAKAFA_MCP_INFORMATIONAL_ROOT = "https://mcp.nakafa.com";

/** Stable server name reported through MCP initialize and health checks. */
export const NAKAFA_MCP_SERVER_NAME = "nakafa-mcp-server";

/** Default item count for paginated agent search results. */
export const NAKAFA_AGENT_DEFAULT_LIMIT = 20;

/** Hard cap for paginated agent search results. */
export const NAKAFA_AGENT_MAX_LIMIT = 50;

/** Hard cap for offset pagination within Convex full-text scan limits. */
export const NAKAFA_AGENT_MAX_OFFSET = 950;

/** Hard cap for alternate query variants in one search request. */
export const NAKAFA_AGENT_MAX_QUERIES = 4;

/** Hard cap for direct Quran reference tool ranges. */
export const NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES = 20;

/** Public content sections exposed to agents. */
export const NAKAFA_AGENT_SECTIONS = [
  "articles",
  "material",
  "tryout",
  "quran",
] as const;
