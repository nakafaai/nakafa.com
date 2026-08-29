import { NAKAFA_MCP_ENDPOINT } from "@repo/contents/_lib/agent/constants";

/** Builds the static MCP usage resource for agent clients. */
export function getNakafaMcpUsageMarkdown() {
  return [
    "# Nakafa MCP Usage",
    "",
    `Use \`${NAKAFA_MCP_ENDPOINT}\` as the Streamable HTTP MCP endpoint.`,
    "",
    "## Workflow",
    "",
    "1. Call `nakafa_get_taxonomy` to inspect supported locales and content sections.",
    "2. Call `nakafa_search_content` with queries, locale, and optional section.",
    "3. Pass source-backed `content_id` values as `content_ref` to `nakafa_get_content`.",
    "4. Cite the returned canonical Nakafa URL in final answers.",
  ].join("\n");
}
