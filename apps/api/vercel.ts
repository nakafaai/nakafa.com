import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import {
  createAgentEdgeRoutes,
  NAKAFA_API_EDGE_PATHS,
} from "@repo/backend/agent/route";
import { NAKAFA_VERCEL_DEPLOYMENT_ENABLED } from "@repo/backend/vercel";
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm build",
  framework: null,
  outputDirectory: "public",
  git: {
    deploymentEnabled: NAKAFA_VERCEL_DEPLOYMENT_ENABLED,
  },
  ...createAgentEdgeRoutes({
    contract: NAKAFA_API_EDGE_CONTRACT,
    paths: NAKAFA_API_EDGE_PATHS,
  }),
};
