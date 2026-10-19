import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  framework: "tanstack-start",
  // Keep database work beside the US East Convex production deployment.
  regions: ["iad1"],
  git: {
    deploymentEnabled: {
      "**": false,
      main: true,
    },
  },
};
