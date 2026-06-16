import { Effect } from "effect";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

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
const mockGetRuntimeContentRoute = vi.hoisted(() => vi.fn());
const mockGetRuntimeContentRouteKindPage = vi.hoisted(() => vi.fn());
const mockGetRuntimeContentRouteParentPage = vi.hoisted(() => vi.fn());

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => mockLocaleRouting.localeMiddleware),
}));

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeContentRoute: mockGetRuntimeContentRoute,
  getRuntimeContentRouteKindPage: mockGetRuntimeContentRouteKindPage,
  getRuntimeContentRouteParentPage: mockGetRuntimeContentRouteParentPage,
}));

describe("proxy", () => {
  beforeEach(() => {
    mockGetRuntimeContentRoute.mockReset();
    mockGetRuntimeContentRouteKindPage.mockReset();
    mockGetRuntimeContentRouteParentPage.mockReset();
    mockGetRuntimeContentRoute.mockReturnValue(
      Effect.succeed({ route: "fixture" })
    );
    mockGetRuntimeContentRouteKindPage.mockReturnValue(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [{ route: "fixture" }],
      })
    );
    mockGetRuntimeContentRouteParentPage.mockReturnValue(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [{ route: "fixture" }],
      })
    );
    mockLocaleRouting.localeMiddleware.mockClear();
  });

  it("bypasses locale routing for PostHog proxy requests", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/_nakafa/i/v0/e/", {
        method: "POST",
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps canonical no-slash URLs for application routes", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/search/")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/search"
    );
  });

  it("bypasses locale routing for the same-origin MCP endpoint", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/mcp"));

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("bypasses locale routing for public AI discovery files", async () => {
    const paths = [
      "/llms.txt",
      "/llms-full.txt",
      "/llms-full/index.json",
      "/llms-full/en.txt",
      "/llms-full/en/material.txt",
      "/skill.md",
      "/.well-known/llms.txt",
      "/.well-known/llms-full.txt",
      "/.well-known/agent-skills/index.json",
      "/.well-known/agent-skills/nakafa/SKILL.md",
    ];

    for (const path of paths) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    }

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("keeps binary 3D model assets out of the locale proxy matcher", () => {
    const matcher = config.matcher ?? [];

    expect(matcher[0]).toContain("glb");
    expect(matcher[0]).toContain("gltf");
    expect(matcher[0]).toContain("bin");
  });

  it("delegates regular routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/search")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(response.headers.get("link")).toBe(
      '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"'
    );
    expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
  });

  it("delegates unsupported locale paths to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/fr/quran/1")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates real public content routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/material/lesson/chemistry/green-chemistry/definition"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(mockGetRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route: "material/lesson/chemistry/green-chemistry/definition",
    });
  });

  it("delegates curriculum app routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/id/curriculum/high-school/10/biology"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
  });

  it("delegates curriculum root routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/curriculum/high-school/10")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(mockGetRuntimeContentRouteKindPage).not.toHaveBeenCalled();
  });

  it("delegates assessment app routes to the locale middleware", async () => {
    const routes = [
      "/id/assessment/middle-school/grade-9",
      "/id/assessment/middle-school/grade-9/mathematics",
    ];

    for (const route of routes) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${route}`)
      );

      expect(response.headers.get("x-locale-proxy")).toBe("1");
    }

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(
      routes.length
    );
    expect(mockGetRuntimeContentRouteKindPage).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
  });

  it("delegates non-read content requests without an exact route lookup", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/articles/politics/not-a-read-check",
        {
          method: "POST",
        }
      )
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates defensive public content roots without an exact route shape", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/unknown-content-root/example")
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("rewrites real public content routes when markdown is requested", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/material/lesson/chemistry/green-chemistry/definition",
        {
          headers: {
            accept: "text/markdown, text/plain;q=0.8",
          },
        }
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/material/lesson/chemistry/green-chemistry/definition"
    );
  });

  it("rewrites source-backed legal routes when markdown is requested", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/terms-of-service", {
        headers: {
          accept: "text/markdown",
        },
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/terms-of-service"
    );
  });

  it("routes static markdown negotiation to the llms source resolver", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/search", {
        headers: {
          accept: "text/markdown",
        },
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/search"
    );
  });

  it("routes static .md URLs to the llms source resolver", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/contributor.md")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/contributor"
    );
  });

  it("delegates subject chapter routes so app routes can redirect", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/material/lesson/chemistry/green-chemistry"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("returns a real 404 for missing markdown public content routes", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/question-9-afdocs-nonexistent-8f3a",
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
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns a real 404 for missing html public content routes", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/id/material/lesson/history/history-introduction/human-space-time"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/id/_not-found"
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("returns a real 404 for missing Quran content routes", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest("http://localhost:3000/id/quran/999")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/id/_not-found"
    );
  });

  it("returns a real 404 for missing html content HEAD requests", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/articles/politics/nepotism-in-political-governance-afdocs-nonexistent-8f3a",
        {
          method: "HEAD",
        }
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns a real 404 for missing article listing routes", async () => {
    mockGetRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [],
      })
    );

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/articles/politics-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns a real 404 when a supported article category has no rows", async () => {
    mockGetRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [],
      })
    );

    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles/politics")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("delegates unmatched curriculum app routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/curriculum/high-school/11-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates unmatched curriculum material app routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/curriculum/high-school/10/mathematics-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates unmatched assessment app routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/assessment/high-school/snbt/general-reasoning-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("fails open when the exact route lookup is temporarily unavailable", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("Convex unavailable"))
    );

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/articles/politics/dynastic-politics-asian-values"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("fails open when a listing route probe is temporarily unavailable", async () => {
    mockGetRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.fail(new Error("Convex unavailable"))
    );

    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles/politics")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates public content folders to the localized app tree", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("preserves markdown alternates for real public content routes", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/question-9.md"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/question-9"
    );
  });

  it("delegates assessment routes that are not material content", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/assessment/high-school/snbt/general-knowledge/try-out/set-1"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });
});
