import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "fastapi",
  buildCommand: "true",
  git: {
    deploymentEnabled: {
      "*": false,
      "changeset-release/main": false,
      main: true,
    },
  },
  rewrites: [
    {
      source: "/(.*)",
      destination: "/api/index",
    },
  ],
};
