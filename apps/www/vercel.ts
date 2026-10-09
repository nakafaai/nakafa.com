import { NAKAFA_VERCEL_DEPLOYMENT_ENABLED } from "@repo/backend/vercel";
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  // Keep database work beside the US East Convex production deployment.
  regions: ["iad1"],
  git: {
    deploymentEnabled: NAKAFA_VERCEL_DEPLOYMENT_ENABLED,
  },
};
