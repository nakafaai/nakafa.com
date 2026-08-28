import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  ignoreCommand:
    'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; node ../../scripts/production-acceptance.ts vercel && exit 0; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages api --exit-code || exit 1',
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
