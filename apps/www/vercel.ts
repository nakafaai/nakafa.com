import { deploymentEnv, routes, type VercelConfig } from "@vercel/config/v1";

const CONVEX_SITE_URL = deploymentEnv("NAKAFA_CONVEX_SITE_URL");

const legacyMcpRewrite = routes.rewrite("/mcp", "https://mcp.nakafa.com/mcp", {
  requestHeaders: { "x-vercel-enable-rewrite-caching": "0" },
  respectOriginCacheControl: false,
});

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
  routes: [
    legacyMcpRewrite,
    {
      dest: `${CONVEX_SITE_URL}/openapi.json`,
      env: ["NAKAFA_CONVEX_SITE_URL"],
      src: "^/openapi\\.json$",
    },
  ],
};
