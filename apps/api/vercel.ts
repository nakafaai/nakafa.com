import {
  deploymentEnv,
  type Route,
  routes,
  type VercelConfig,
} from "@vercel/config/v1";

const CONVEX_SITE_URL = deploymentEnv("NAKAFA_CONVEX_SITE_URL");
const API_EDGE_SECRET = deploymentEnv("NAKAFA_API_EDGE_SECRET");
const API_EDGE_SECRET_HEADER = "x-nakafa-api-edge-secret";

/** Creates one no-cache external rewrite with an edge-owned origin secret. */
function protectedApiRewrite(source: string, destination: string): Route {
  const rewrite = routes.rewrite(source, destination, {
    requestHeaders: {
      [API_EDGE_SECRET_HEADER]: API_EDGE_SECRET,
      "x-vercel-enable-rewrite-caching": "0",
    },
    respectOriginCacheControl: false,
  });
  if (!("transforms" in rewrite && rewrite.transforms)) {
    throw new Error("Expected a transformed Vercel API rewrite.");
  }
  return {
    ...rewrite,
    transforms: [
      {
        op: "delete",
        target: { key: API_EDGE_SECRET_HEADER },
        type: "request.headers",
      },
      ...rewrite.transforms,
    ],
  };
}

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  ignoreCommand:
    'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages api --exit-code || exit 1',
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
  routes: [
    protectedApiRewrite("/v1", `${CONVEX_SITE_URL}/v1`),
    protectedApiRewrite("/v1/:path*", `${CONVEX_SITE_URL}/v1/:path*`),
    {
      dest: `${CONVEX_SITE_URL}/openapi.json`,
      env: ["NAKAFA_CONVEX_SITE_URL"],
      src: "^/openapi\\.json$",
    },
  ],
};
