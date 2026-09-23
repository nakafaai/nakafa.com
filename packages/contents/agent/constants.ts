/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_BASE_URL = "https://nakafa.com";

/** Canonical public REST API origin. */
export const NAKAFA_API_BASE_URL = "https://api.nakafa.com";

/** Stable compatibility namespace for the public REST contract. */
export const NAKAFA_PUBLIC_API_PATH = "/v1";

/** Reported version of the only supported public REST contract, V1. */
export const NAKAFA_PUBLIC_API_VERSION = "1.0.0";

/** Canonical public Streamable HTTP MCP endpoint. */
export const NAKAFA_MCP_ENDPOINT = "https://mcp.nakafa.com/mcp";

/** Canonical values for the public V1 taxonomy endpoint guidance. */
export const NAKAFA_MCP_GUIDANCE = {
  direct: NAKAFA_MCP_ENDPOINT,
  recommended: NAKAFA_MCP_ENDPOINT,
  root_note: `${new URL(NAKAFA_MCP_ENDPOINT).origin} is informational only.`,
} as const;

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
