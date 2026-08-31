import { describe, expect, it } from "@effect/vitest";
import {
  type AgentEdgeContract,
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import {
  createAgentEdgeRoutes,
  NAKAFA_API_EDGE_PATHS,
} from "@repo/backend/agent/route";

function expectedRoute(
  contract: AgentEdgeContract,
  source: string,
  destination: string
) {
  return {
    src: source,
    dest: destination,
    env: [contract.originEnvironment],
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
        target: { key: contract.secretHeader },
      },
      {
        type: "request.headers",
        op: "set",
        target: { key: contract.secretHeader },
        args: `$${contract.secretEnvironment}`,
        env: [contract.secretEnvironment],
      },
      {
        type: "response.headers",
        op: "set",
        target: { key: NAKAFA_EDGE_RELEASE_SHA_HEADER },
        args: `$${VERCEL_GIT_COMMIT_SHA_ENVIRONMENT}`,
        env: [VERCEL_GIT_COMMIT_SHA_ENVIRONMENT],
      },
    ],
  };
}

describe("agent Vercel routes", () => {
  it("maps the versioned public API to separated protected capabilities", () => {
    expect(
      createAgentEdgeRoutes({
        contract: NAKAFA_API_EDGE_CONTRACT,
        paths: NAKAFA_API_EDGE_PATHS,
      })
    ).toEqual({
      routes: [
        expectedRoute(
          NAKAFA_API_EDGE_CONTRACT,
          "^/openapi\\.json$",
          "$NAKAFA_CONVEX_SITE_URL/internal/agent/openapi"
        ),
        expectedRoute(
          NAKAFA_API_EDGE_CONTRACT,
          "^/v1$",
          "$NAKAFA_CONVEX_SITE_URL/internal/agent/runtime"
        ),
        expectedRoute(
          NAKAFA_API_EDGE_CONTRACT,
          "^/v1/(.*)$",
          "$NAKAFA_CONVEX_SITE_URL/internal/agent/runtime/$1"
        ),
      ],
    });
  });

  it("maps the MCP endpoint to its protected transport", () => {
    const paths = [{ source: "^/mcp$", suffix: "" }] as const;

    expect(
      createAgentEdgeRoutes({ contract: NAKAFA_MCP_EDGE_CONTRACT, paths })
    ).toEqual({
      routes: [
        expectedRoute(
          NAKAFA_MCP_EDGE_CONTRACT,
          "^/mcp$",
          "$NAKAFA_CONVEX_SITE_URL/internal/mcp"
        ),
      ],
    });
  });

  it.each([
    "/openapi.json",
    "/v1",
    "/v1/health",
    "/v1/search",
    "/v1/content",
    "/v1/missing",
    "/v1/openapi.json",
    "/v1/taxonomy",
    "/v1/quran/1",
  ])("forwards declared API route %s", (path) => {
    expect(
      NAKAFA_API_EDGE_PATHS.some(({ source }) =>
        new RegExp(source, "u").test(path)
      )
    ).toBe(true);
  });

  it.each([
    "/",
    "/health",
    "/search",
    "/content",
    "/taxonomy",
    "/quran/1",
    "/robots.txt",
    "/missing",
    "/v2",
  ])("leaves non-contract route %s outside the API bridge", (path) => {
    expect(
      NAKAFA_API_EDGE_PATHS.some(({ source }) =>
        new RegExp(source, "u").test(path)
      )
    ).toBe(false);
  });
});
