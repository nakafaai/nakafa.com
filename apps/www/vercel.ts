import type { VercelConfig } from "@vercel/config/v1";

/** Identifies the Vercel build that already ran the isolated app typecheck. */
export function hasIsolatedTypecheck(vercel: "1" | undefined) {
  return vercel === "1";
}

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  ignoreCommand: "sh ../../scripts/vercel/scope.sh www",
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
