import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  git: {
    deploymentEnabled: {
      "*": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
