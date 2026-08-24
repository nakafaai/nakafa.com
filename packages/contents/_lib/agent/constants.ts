/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_BASE_URL = "https://nakafa.com";

/** Canonical public REST API origin. */
export const NAKAFA_API_BASE_URL = "https://api.nakafa.com";

/** Recommended public Streamable HTTP MCP endpoint. */
export const NAKAFA_MCP_RECOMMENDED_ENDPOINT = "https://mcp.nakafa.com/mcp";

/** Direct MCP application endpoint for clients that prefer the subdomain. */
export const NAKAFA_MCP_DIRECT_ENDPOINT = "https://mcp.nakafa.com/mcp";

/** Informational subdomain root; this is not a transport endpoint. */
export const NAKAFA_MCP_INFORMATIONAL_ROOT = "https://mcp.nakafa.com";

/** Hard cap for direct Quran reference tool ranges. */
export const NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES = 20;

/** Public content sections exposed to agents. */
export const NAKAFA_AGENT_SECTIONS = [
  "articles",
  "material",
  "tryout",
  "quran",
] as const;
