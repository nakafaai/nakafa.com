import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createAgentEdgeRoutes } from "@repo/backend/agent/route";
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm build",
  framework: null,
  outputDirectory: "public",
  git: {
    deploymentEnabled: {
      "**": false,
      main: true,
    },
  },
  ...createAgentEdgeRoutes(NAKAFA_MCP_EDGE_CONTRACT, [
    { source: "^/mcp$", suffix: "" },
  ]),
};
