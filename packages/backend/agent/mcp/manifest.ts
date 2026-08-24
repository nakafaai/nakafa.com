export const NAKAFA_MCP_REGISTRY_MANIFEST = {
  $schema:
    "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  description:
    "Read-only access to Nakafa's signed educational content and reviewed Quran references.",
  name: "io.github.nakafaai/nakafa",
  remotes: [
    {
      type: "streamable-http",
      url: "https://mcp.nakafa.com/mcp",
    },
  ],
  repository: {
    source: "github",
    url: "https://github.com/nakafaai/nakafa.com",
  },
  title: "Nakafa",
  version: "1.0.0",
  websiteUrl: "https://nakafa.com/developers",
};
