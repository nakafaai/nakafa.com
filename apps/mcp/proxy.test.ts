import {
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

vi.mock("@/env", () => ({
  env: {
    NAKAFA_CONVEX_SITE_URL: "https://test.convex.site",
    NAKAFA_MCP_EDGE_SECRET: "test-mcp-edge-secret",
    VERCEL_GIT_COMMIT_SHA: "b".repeat(40),
  },
}));

describe("MCP proxy", () => {
  it("matches only the canonical MCP transport", () => {
    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });

    expect(matches("/mcp")).toBe(true);
    expect(["/", "/health", "/mcp/tools"].some(matches)).toBe(false);
  });

  it("rewrites to the protected Convex origin", () => {
    const request = new NextRequest("https://mcp.nakafa.com/mcp?session=1", {
      headers: {
        authorization: "Bearer private-user-token",
        cookie: "session=private",
        "content-type": "application/json",
        host: "hostile.example.com",
        "mcp-param-region": "eu-central",
        [NAKAFA_MCP_EDGE_CONTRACT.secretHeader]: "hostile-secret",
        "x-forwarded-for": "203.0.113.20",
      },
      method: "POST",
    });

    const response = proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://test.convex.site/internal/mcp?session=1"
    );
    expect(response.headers.get(NAKAFA_EDGE_RELEASE_SHA_HEADER)).toBe(
      "b".repeat(40)
    );
    expect(
      response.headers.get(
        `x-middleware-request-${NAKAFA_MCP_EDGE_CONTRACT.secretHeader}`
      )
    ).toBe("test-mcp-edge-secret");
    expect(response.headers.get("x-middleware-request-content-type")).toBe(
      "application/json"
    );
    expect(response.headers.get("x-middleware-request-mcp-param-region")).toBe(
      "eu-central"
    );
    expect(response.headers.get("x-middleware-request-x-forwarded-for")).toBe(
      "203.0.113.20"
    );
    expect(response.headers.get("x-middleware-request-host")).toBe(
      "mcp.nakafa.com"
    );
    const forwarded = response.headers.get("x-middleware-override-headers");
    expect(forwarded).not.toContain("authorization");
    expect(forwarded).not.toContain("cookie");
    expect(forwarded).toContain("host");
  });
});
