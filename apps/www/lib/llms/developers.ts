const DEVELOPER_LINKS = {
  api: "https://api.nakafa.com/v1",
  mcp: "https://mcp.nakafa.com/mcp",
  openApi: "https://api.nakafa.com/openapi.json",
} as const;

/** Builds the scoped machine-readable index for developer resources. */
export function buildDeveloperLlmsIndexText() {
  return [
    "# Nakafa Developer Resources",
    "",
    "> Public, read-only interfaces for agents and developer tooling. No user authentication is required.",
    "",
    "## REST and schemas",
    "",
    `- [Nakafa Public API](${DEVELOPER_LINKS.api}): service index and version policy.`,
    `- [Nakafa OpenAPI 3.1](${DEVELOPER_LINKS.openApi}): typed operations, parameters, responses, and Problem Details errors.`,
    "- API version: v1. Compatible additions stay in v1; breaking changes require v2.",
    "- Client budget: no more than 120 requests per 60 seconds from one IP; handle HTTP 429 with backoff.",
    "",
    "## Agent interfaces",
    "",
    `- [Nakafa MCP](${DEVELOPER_LINKS.mcp}): Streamable HTTP endpoint and registry manifest.`,
    "- [Nakafa agent instructions](https://nakafa.com/skill.md): when and how to use Nakafa tools.",
    "- [Nakafa CLI](https://www.npmjs.com/package/nakafa-cli): Node 24 command-line client named `nakafa`.",
    "",
  ].join("\n");
}
