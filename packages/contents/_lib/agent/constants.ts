/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_BASE_URL = "https://nakafa.com";

/** Canonical public REST API origin. */
export const NAKAFA_API_BASE_URL = "https://api.nakafa.com";

/** Current compatible version of the public REST contract. */
export const NAKAFA_PUBLIC_API_VERSION = "1.0.0";

/** Version of the OpenAPI document that introduces canonical Quran semantics. */
export const NAKAFA_PUBLIC_API_DOCUMENT_VERSION = "2.0.0";

/** Recommended public Streamable HTTP MCP endpoint. */
export const NAKAFA_MCP_RECOMMENDED_ENDPOINT = "https://nakafa.com/mcp";

/** Direct MCP application endpoint for clients that prefer the subdomain. */
export const NAKAFA_MCP_DIRECT_ENDPOINT = "https://mcp.nakafa.com/mcp";

/** Informational subdomain root; this is not a transport endpoint. */
export const NAKAFA_MCP_INFORMATIONAL_ROOT = "https://mcp.nakafa.com";

/** Stable server name reported through MCP initialize and health checks. */
export const NAKAFA_MCP_SERVER_NAME = "nakafa-mcp-server";

/** Stable server version reported through every supported MCP revision. */
export const NAKAFA_MCP_SERVER_VERSION = "1.0.1";

/** Modern wire revision served by the installed MCP server v2 contract. */
export const NAKAFA_MCP_PROTOCOL_VERSION = "2026-07-28";

/** Hard cap for direct Quran reference tool ranges. */
export const NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES = 20;

/** Public content sections exposed to agents. */
export const NAKAFA_AGENT_SECTIONS = [
  "articles",
  "material",
  "tryout",
  "quran",
] as const;
