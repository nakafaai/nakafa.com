/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_BASE_URL = "https://nakafa.com";

/** Canonical public REST API origin. */
export const NAKAFA_API_BASE_URL = "https://api.nakafa.com";

/** Current compatible version of the public REST contract. */
export const NAKAFA_PUBLIC_API_VERSION = "1.0.0";

/** Recommended public Streamable HTTP MCP endpoint. */
export const NAKAFA_MCP_RECOMMENDED_ENDPOINT = "https://mcp.nakafa.com/mcp";

/** Existing same-origin MCP endpoint retained during the legacy-client window. */
export const NAKAFA_MCP_LEGACY_ENDPOINT = "https://nakafa.com/mcp";

/** Current MCP wire revision implemented by the public Nakafa server. */
export const NAKAFA_MCP_PROTOCOL_VERSION = "2026-07-28";

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
