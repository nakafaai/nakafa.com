import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "fastapi",
  buildCommand: "turbo run build && uv sync --no-dev --frozen",
  ignoreCommand:
    'node "$(git rev-parse --show-toplevel)/scripts/vercel/step.mjs" cas',
  git: {
    deploymentEnabled: {
      "**": false,
      main: true,
    },
  },
};
