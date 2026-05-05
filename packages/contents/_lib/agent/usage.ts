import {
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";

/** Builds the static MCP usage resource for agent clients. */
export function getNakafaMcpUsageMarkdown() {
  return [
    "# Nakafa MCP Usage",
    "",
    `Use \`${NAKAFA_MCP_RECOMMENDED_ENDPOINT}\` as the recommended Streamable HTTP MCP endpoint.`,
    `Use \`${NAKAFA_MCP_DIRECT_ENDPOINT}\` only when a direct MCP subdomain endpoint is preferred.`,
    `\`${NAKAFA_MCP_INFORMATIONAL_ROOT}\` is informational only and is not an MCP transport endpoint.`,
    "",
    "## Workflow",
    "",
    "1. Call `nakafa_get_taxonomy` to inspect supported locales and content sections.",
    "2. Call `nakafa_search_content` with a query, locale, and optional section.",
    "3. Pass the returned `content_id` as `content_ref` to `nakafa_get_content` or `nakafa_get_exercise`.",
    "4. Cite the returned canonical Nakafa URL in final answers.",
  ].join("\n");
}
