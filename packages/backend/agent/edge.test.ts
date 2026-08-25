import {
  getAgentEdgeContract,
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
  NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS,
  NAKAFA_EDGE_CLIENT_IP_HEADER,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
  NAKAFA_MCP_EDGE_CONTRACT,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
  VERCEL_REWRITE_CACHE_CONTROL_HEADER,
} from "@repo/backend/agent/edge";
import { describe, expect, it } from "@repo/testing/effect";

describe("agent edge contracts", () => {
  it("owns the exact API and MCP secret boundaries", () => {
    expect(NAKAFA_API_EDGE_CONTRACT).toEqual({
      secretEnvironment: "NAKAFA_API_EDGE_SECRET",
      secretHeader: "x-nakafa-api-edge-secret",
      surface: "api",
    });
    expect(NAKAFA_MCP_EDGE_CONTRACT).toEqual({
      secretEnvironment: "NAKAFA_MCP_EDGE_SECRET",
      secretHeader: "x-nakafa-mcp-edge-secret",
      surface: "mcp",
    });
    expect(getAgentEdgeContract("api")).toBe(NAKAFA_API_EDGE_CONTRACT);
    expect(getAgentEdgeContract("mcp")).toBe(NAKAFA_MCP_EDGE_CONTRACT);
  });

  it("owns shared routing and browser-origin configuration names", () => {
    expect(NAKAFA_CONVEX_SITE_URL_ENVIRONMENT).toBe("NAKAFA_CONVEX_SITE_URL");
    expect(NAKAFA_EDGE_CLIENT_IP_HEADER).toBe("x-forwarded-for");
    expect(NAKAFA_EDGE_RELEASE_SHA_HEADER).toBe("x-nakafa-release-sha");
    expect(NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT).toBe(
      "NAKAFA_MCP_ALLOWED_ORIGINS"
    );
    expect(NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS).toEqual([
      "https://nakafa.com",
      "https://www.nakafa.com",
    ]);
    expect(VERCEL_REWRITE_CACHE_CONTROL_HEADER).toBe(
      "x-vercel-enable-rewrite-caching"
    );
    expect(VERCEL_GIT_COMMIT_SHA_ENVIRONMENT).toBe("VERCEL_GIT_COMMIT_SHA");
  });
});
