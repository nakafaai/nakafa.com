import { NAKAFA_MCP_SERVER_VERSION } from "@repo/backend/agent/mcp/identity";
import { NAKAFA_MCP_RECOMMENDED_ENDPOINT } from "@repo/contents/_lib/agent/constants";

export const NAKAFA_MCP_REGISTRY_MANIFEST = {
  $schema:
    "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  description:
    "Read-only access to Nakafa's signed educational content and reviewed Quran references.",
  name: "io.github.nakafaai/nakafa",
  remotes: [
    {
      type: "streamable-http",
      url: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
    },
  ],
  repository: {
    source: "github",
    url: "https://github.com/nakafaai/nakafa.com",
  },
  title: "Nakafa",
  version: NAKAFA_MCP_SERVER_VERSION,
  websiteUrl: "https://nakafa.com",
};
