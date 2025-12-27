import type { VercelConfig } from "@vercel/config/v1";

const config: VercelConfig = {
  git: {
    deploymentEnabled: {
      "changeset-release/main": false,
    },
  },
};

export default config;
