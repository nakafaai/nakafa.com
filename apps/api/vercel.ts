import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import {
  createAgentEdgeRoute,
  NAKAFA_API_ROUTE_SOURCE,
} from "@repo/backend/agent/route";
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm build",
  framework: null,
  ignoreCommand: "sh ../../scripts/vercel/scope.sh api",
  outputDirectory: "public",
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
  ...createAgentEdgeRoute({
    contract: NAKAFA_API_EDGE_CONTRACT,
    source: NAKAFA_API_ROUTE_SOURCE,
    suffix: "/$1",
  }),
};

export default config;
