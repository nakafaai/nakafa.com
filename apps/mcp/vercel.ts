import {
  deploymentEnv,
  type Route,
  routes,
  type VercelConfig,
} from "@vercel/config/v1";

const CONVEX_SITE_URL = deploymentEnv("NAKAFA_CONVEX_SITE_URL");
const MCP_EDGE_SECRET = deploymentEnv("NAKAFA_MCP_EDGE_SECRET");
const MCP_EDGE_SECRET_HEADER = "x-nakafa-mcp-edge-secret";

const NOT_FOUND_ROUTE: Route = {
  dest: "/not-found.json",
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  },
  src: "^/.*$",
  status: 404,
};

/** Creates the canonical no-cache MCP external rewrite. */
function protectedMcpRewrite(): Route {
  const rewrite = routes.rewrite("/mcp", `${CONVEX_SITE_URL}/mcp`, {
    requestHeaders: {
      [MCP_EDGE_SECRET_HEADER]: MCP_EDGE_SECRET,
      "x-vercel-enable-rewrite-caching": "0",
    },
    respectOriginCacheControl: false,
  });
  if (!("transforms" in rewrite && rewrite.transforms)) {
    throw new Error("Expected a transformed Vercel MCP rewrite.");
  }
  return {
    ...rewrite,
    transforms: [
      {
        op: "delete",
        target: { key: MCP_EDGE_SECRET_HEADER },
        type: "request.headers",
      },
      ...rewrite.transforms,
    ],
  };
}

export const config: VercelConfig = {
  buildCommand: "pnpm run build:vercel",
  framework: null,
  ignoreCommand:
    'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages mcp --exit-code || exit 1',
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
  routes: [
    {
      dest: "https://nakafa.com/developers",
      src: "^/$",
      status: 308,
    },
    protectedMcpRewrite(),
    NOT_FOUND_ROUTE,
  ],
  outputDirectory: "public",
};
