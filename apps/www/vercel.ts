import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  // Skip the build, and with it the new deployment and its empty caches, when
  // nothing that the app is built from changed. Its build deploys the Convex
  // functions, so a change to `packages/backend` builds it.
  ignoreCommand:
    'node "$(git rev-parse --show-toplevel)/scripts/vercel/ignore.mjs" www',
  // Keep database work beside the US East Convex production deployment.
  regions: ["iad1"],
  git: {
    deploymentEnabled: {
      "**": false,
      main: true,
    },
  },
};
