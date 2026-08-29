import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createAgentEdgeRoute } from "@repo/backend/agent/route";
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm build",
  framework: null,
  ignoreCommand: "sh ../../scripts/vercel/scope.sh mcp",
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
  ...createAgentEdgeRoute({
    contract: NAKAFA_MCP_EDGE_CONTRACT,
    source: "^/mcp$",
    suffix: "",
  }),
};

export default config;
