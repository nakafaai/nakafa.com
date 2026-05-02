import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const localeMiddleware = vi.fn(() => {
  const response = NextResponse.next();
  response.headers.set("x-locale-proxy", "1");
  return response;
});

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => localeMiddleware),
}));

describe("proxy", () => {
  beforeEach(() => {
    localeMiddleware.mockClear();
  });

  it("bypasses locale routing for PostHog proxy requests", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest("http://localhost:3000/_nakafa/i/v0/e/", {
        method: "POST",
      })
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps canonical no-slash URLs for application routes", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3000/en/search/"));

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/search"
    );
  });

  it("bypasses locale routing for the same-origin MCP endpoint", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3000/mcp"));

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("delegates regular routes to the locale middleware", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3000/en/search"));

    expect(localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });
});
