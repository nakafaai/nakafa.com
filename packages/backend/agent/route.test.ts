import { describe, expect, it } from "@effect/vitest";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import {
  createAgentEdgeRoute,
  NAKAFA_API_ROUTE_SOURCE,
} from "@repo/backend/agent/route";

describe("agent Vercel route", () => {
  it.each([
    {
      contract: NAKAFA_API_EDGE_CONTRACT,
      destination: "$NAKAFA_CONVEX_SITE_URL/internal/agent/$1",
      source: NAKAFA_API_ROUTE_SOURCE,
      suffix: "/$1",
    },
    {
      contract: NAKAFA_MCP_EDGE_CONTRACT,
      destination: "$NAKAFA_CONVEX_SITE_URL/internal/mcp",
      source: "^/mcp$",
      suffix: "",
    },
  ])("protects $source before rewriting to Convex", (input) => {
    expect(
      createAgentEdgeRoute({
        contract: input.contract,
        source: input.source,
        suffix: input.suffix,
      })
    ).toEqual({
      routes: [
        {
          src: input.source,
          dest: input.destination,
          env: [input.contract.originEnvironment],
          respectOriginCacheControl: false,
          transforms: [
            {
              type: "request.headers",
              op: "delete",
              target: { key: "authorization" },
            },
            {
              type: "request.headers",
              op: "delete",
              target: { key: "cookie" },
            },
            {
              type: "request.headers",
              op: "delete",
              target: { key: input.contract.secretHeader },
            },
            {
              type: "request.headers",
              op: "set",
              target: { key: input.contract.secretHeader },
              args: `$${input.contract.secretEnvironment}`,
              env: [input.contract.secretEnvironment],
            },
            {
              type: "response.headers",
              op: "set",
              target: { key: NAKAFA_EDGE_RELEASE_SHA_HEADER },
              args: `$${VERCEL_GIT_COMMIT_SHA_ENVIRONMENT}`,
              env: [VERCEL_GIT_COMMIT_SHA_ENVIRONMENT],
            },
          ],
        },
      ],
    });
  });

  it.each([
    "/",
    "/openapi.json",
    "/health",
    "/search",
    "/content",
    "/taxonomy",
    "/quran/1",
    "/v1",
    "/v1/health",
    "/v1/search",
    "/v1/content",
    "/v1/missing",
    "/v1/openapi.json",
    "/v1/taxonomy",
    "/v1/quran/1",
  ])("forwards declared API route %s", (path) => {
    const source = new RegExp(NAKAFA_API_ROUTE_SOURCE, "u");

    expect(source.test(path)).toBe(true);
  });

  it.each(["/robots.txt", "/missing"])(
    "leaves undeclared route %s outside the API bridge",
    (path) => {
      const source = new RegExp(NAKAFA_API_ROUTE_SOURCE, "u");

      expect(source.test(path)).toBe(false);
    }
  );
});
