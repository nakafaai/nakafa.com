import type { VercelConfig } from "@vercel/config/v1";

/** Identifies the Vercel build that already ran the isolated app typecheck. */
export function hasIsolatedTypecheck(vercel: "1" | undefined) {
  return vercel === "1";
}

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
