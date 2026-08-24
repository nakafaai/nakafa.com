import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  ignoreCommand:
    'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages www --exit-code || exit 1',
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
