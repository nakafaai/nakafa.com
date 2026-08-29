import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  ignoreCommand: "sh ../../scripts/vercel/scope.sh mcp",
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
