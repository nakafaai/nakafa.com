import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const mockLocaleRouting = vi.hoisted(() => ({
  localeMiddleware: vi.fn(
    () =>
      new Response(null, {
        headers: {
          "x-locale-proxy": "1",
        },
      })
  ),
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => mockLocaleRouting.localeMiddleware),
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
    "/exercises/middle-school/grade-9",
    "/exercises/middle-school/grade-9/mathematics",
    "/subject/high-school/10/biology",
    "/subject/high-school/10/chemistry/green-chemistry",
    "/subject/high-school/10/chemistry/green-chemistry/definition",
    "/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9",
  ],
}));

describe("proxy", () => {
  beforeEach(() => {
    mockLocaleRouting.localeMiddleware.mockClear();
  });

  it("bypasses locale routing for PostHog proxy requests", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/_nakafa/i/v0/e/", {
        method: "POST",
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps canonical no-slash URLs for application routes", () => {
    const response = proxy(new NextRequest("http://localhost:3000/en/search/"));

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/search"
    );
  });

  it("bypasses locale routing for the same-origin MCP endpoint", () => {
    const response = proxy(new NextRequest("http://localhost:3000/mcp"));

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("bypasses locale routing for public AI discovery files", () => {
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

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("delegates regular routes to the locale middleware", () => {
    const response = proxy(new NextRequest("http://localhost:3000/en/search"));

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(response.headers.get("link")).toBe(
      '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"'
    );
    expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
  });

  it("delegates unsupported locale paths to the locale middleware", () => {
    const response = proxy(new NextRequest("http://localhost:3000/fr/quran/1"));

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates real public content routes to the locale middleware", () => {
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/subject/high-school/10/chemistry/green-chemistry/definition"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates subject material listing routes to the locale middleware", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/id/subject/high-school/10/biology")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates exercises listing routes to the locale middleware", () => {
    const routes = [
      "/id/exercises/middle-school/grade-9",
      "/id/exercises/middle-school/grade-9/mathematics",
    ];

    for (const route of routes) {
      const response = proxy(new NextRequest(`http://localhost:3000${route}`));

      expect(response.headers.get("x-locale-proxy")).toBe("1");
    }

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(
      routes.length
    );
  });

  it("rewrites real public content routes when markdown is requested", () => {
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

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/subject/high-school/10/chemistry/green-chemistry/definition"
    );
  });

  it("redirects subject chapter routes to the material root", () => {
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/subject/high-school/10/chemistry/green-chemistry"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/subject/high-school/10/chemistry"
    );
  });

  it("returns a real 404 for missing public content routes", async () => {
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

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/__not-found"
    );
    await expect(response.text()).resolves.toBe("");
  });

  it("returns a real 404 for public content folders that are not pages", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/en/articles")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it("preserves markdown alternates for real public content routes", () => {
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9.md"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9"
    );
  });

  it("redirects legacy yearless try-out routes before rendering", () => {
    const response = proxy(
      new NextRequest(
        "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/set-1"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1"
    );
  });
});
