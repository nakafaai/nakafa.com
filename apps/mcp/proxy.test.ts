import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

const MCP_EDGE_SECRET_HEADER = "x-nakafa-mcp-edge-secret";

vi.mock("@/env", () => ({
  env: {
    NAKAFA_CONVEX_SITE_URL: "https://test.convex.site",
    NAKAFA_MCP_EDGE_SECRET: "test-mcp-edge-secret",
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
        [MCP_EDGE_SECRET_HEADER]: "hostile-secret",
        "x-forwarded-for": "203.0.113.20",
      },
      method: "POST",
    });

    const response = proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://test.convex.site/internal/mcp?session=1"
    );
    expect(
      response.headers.get(`x-middleware-request-${MCP_EDGE_SECRET_HEADER}`)
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
    const forwarded = response.headers.get("x-middleware-override-headers");
    expect(forwarded).not.toContain("authorization");
    expect(forwarded).not.toContain("cookie");
    expect(forwarded).not.toContain("host");
  });
});
