import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import {
  createAgentEdgeRoutes,
  NAKAFA_API_EDGE_PATHS,
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
  ...createAgentEdgeRoutes({
    contract: NAKAFA_API_EDGE_CONTRACT,
    paths: NAKAFA_API_EDGE_PATHS,
  }),
};

export default config;
