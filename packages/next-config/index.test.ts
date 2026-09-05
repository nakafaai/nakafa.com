import { describe, expect, it } from "@effect/vitest";
import {
  config,
  createLoopbackConnectSources,
  createSecurityHeaders,
  securityHeaders,
} from "@repo/next-config";

describe("createLoopbackConnectSources", () => {
  it("allows the exact HTTP and WebSocket origins for local Convex", () => {
    expect(
      createLoopbackConnectSources(new URL("http://127.0.0.1:3210/api/query"))
    ).toEqual(["http://127.0.0.1:3210", "ws://127.0.0.1:3210"]);
    expect(
      createLoopbackConnectSources(new URL("http://localhost:3210"))
    ).toEqual(["http://localhost:3210", "ws://localhost:3210"]);
  });

  it("does not widen remote or secure Convex origins", () => {
    expect(
      createLoopbackConnectSources(
        new URL("https://dapper-antelope-269.convex.cloud")
      )
    ).toEqual([]);
    expect(
      createLoopbackConnectSources(new URL("http://example.com:3210"))
    ).toEqual([]);
  });
});

describe("createSecurityHeaders", () => {
  it("builds the default CSP header", () => {
    const csp = createSecurityHeaders().find(
      (header) => header.key === "Content-Security-Policy"
    );

    expect(csp?.value).toContain("script-src 'self'");
    expect(csp?.value).toContain("connect-src 'self'");
    expect(csp?.value).not.toContain("https://raw.githubusercontent.com");
    expect(csp?.value).toContain("media-src 'self'");
    expect(csp?.value).not.toContain("posthog.com");
  });

  it("adds app-owned connect sources without widening shared apps", () => {
    const csp = createSecurityHeaders({
      additionalConnectSources: ["https://raw.githubusercontent.com"],
    }).find((header) => header.key === "Content-Security-Policy");

    expect(csp?.value).toContain(
      "connect-src 'self' wss://*.convex.cloud https://*.convex.cloud"
    );
    expect(csp?.value).toContain("https://raw.githubusercontent.com");
  });

  it("exposes shared headers through the Next config", () => {
    const headers = config.headers;

    if (!headers) {
      throw new Error("Expected shared Next config headers.");
    }

    const headerConfig = headers();

    expect(headerConfig).toStrictEqual([
      {
        headers: securityHeaders,
        source: "/:path*",
      },
    ]);
  });
});
