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

vi.mock("@/lib/sitemap/routes", () => ({
  getPublicContentRedirects: () => [
    [
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ],
  ],
  getPublicContentRouteRoots: () => [
    "/articles",
    "/subject",
    "/exercises",
    "/quran",
  ],
  getPublicContentRequestRoutes: () => [
    "/subject/high-school/10/chemistry/green-chemistry",
    "/subject/high-school/10/chemistry/green-chemistry/definition",
    "/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9",
  ],
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

  it("bypasses locale routing for public AI discovery files", async () => {
    const { proxy } = await import("@/proxy");
    const paths = [
      "/llms.txt",
      "/llms-full.txt",
      "/llms-full/index.json",
      "/llms-full/en.txt",
      "/llms-full/en/subject.txt",
      "/skill.md",
      "/.well-known/llms.txt",
      "/.well-known/llms-full.txt",
      "/.well-known/agent-skills/index.json",
      "/.well-known/agent-skills/nakafa/SKILL.md",
      "/.well-known/skills/index.json",
      "/.well-known/skills/nakafa/SKILL.md",
      "/.well-known/skills/nakafa/skill.md",
    ];

    for (const path of paths) {
      const response = proxy(new NextRequest(`http://localhost:3000${path}`));

      expect(response.headers.get("x-middleware-next")).toBe("1");
    }

    expect(localeMiddleware).not.toHaveBeenCalled();
  });

  it("delegates regular routes to the locale middleware", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3000/en/search"));

    expect(localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(response.headers.get("link")).toBe(
      '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"'
    );
    expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
  });

  it("delegates unsupported locale paths to the locale middleware", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3000/fr/quran/1"));

    expect(localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates real public content routes to the locale middleware", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/subject/high-school/10/chemistry/green-chemistry/definition"
      )
    );

    expect(localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("rewrites real public content routes when markdown is requested", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/subject/high-school/10/chemistry/green-chemistry/definition",
        {
          headers: {
            accept: "text/markdown, text/plain;q=0.8",
          },
        }
      )
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/subject/high-school/10/chemistry/green-chemistry/definition"
    );
  });

  it("redirects subject chapter routes to the material root", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/subject/high-school/10/chemistry/green-chemistry"
      )
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/subject/high-school/10/chemistry"
    );
  });

  it("returns a real 404 for missing public content routes", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9-afdocs-nonexistent-8f3a",
        {
          headers: {
            accept: "text/markdown",
          },
        }
      )
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not Found");
  });

  it("returns a real 404 for public content folders that are not pages", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest("http://localhost:3000/en/articles")
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it("preserves markdown alternates for real public content routes", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9.md"
      )
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9"
    );
  });

  it("redirects legacy yearless try-out routes before rendering", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/set-1"
      )
    );

    expect(localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1"
    );
  });
});
