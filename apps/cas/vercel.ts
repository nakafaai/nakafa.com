import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "fastapi",
  buildCommand: "turbo run build && uv sync --no-dev --frozen",
  git: {
    deploymentEnabled: {
      "**": false,
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
