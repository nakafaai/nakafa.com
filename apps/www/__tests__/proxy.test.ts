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
        "http://localhost:3000/en/subjects/chemistry/green-chemistry/definition"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
  });

  it("delegates curriculum app routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/id/kurikulum/merdeka/kelas-10/biologi"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
  });

  it("delegates curriculum root routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/curriculum/merdeka/class-10")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(mockGetRuntimeContentRouteKindPage).not.toHaveBeenCalled();
  });

  it("delegates assessment app routes to the locale middleware", async () => {
    const routes = [
      "/id/ujian/snbt",
      "/id/ujian/snbt/pengetahuan-kuantitatif/tryout/2026",
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

  it("returns a real 404 for invalid public material route segments", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/mathematics/integral/invalid.segment"
      )
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("rejects stale localized route namespaces before locale normalization", async () => {
    const paths = [
      "/id/curriculum/high-school/10",
      "/id/assessment/snbt-2026/pengetahuan-kuantitatif",
      "/id/subject/matematika/integral",
      "/id/exercises/snbt/pengetahuan-kuantitatif",
      "/en/kurikulum/merdeka/kelas-10",
      "/en/materi/mathematics/integral",
    ];

    for (const path of paths) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/_not-found"
      );
    }

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("rejects the invisible learn route group as a public route", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/learn")
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("rewrites real public content routes when markdown is requested", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/mathematics/integral/area-of-a-flat-surface",
        {
          headers: {
            accept: "text/markdown, text/plain;q=0.8",
          },
        }
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route: "material/lesson/mathematics/integral/area-of-a-flat-surface",
    });
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/subjects/mathematics/integral/area-of-a-flat-surface"
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

  it("rewrites app-shell markdown routes without runtime row probes", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles.md")
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/articles"
    );
  });

  it("returns a real 404 for invalid markdown taxonomy routes", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles/not-a-category.md")
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns a real 404 for material topic grouping routes", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/chemistry/green-chemistry"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns a real 404 for missing markdown public content routes", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/practice/snbt/general-knowledge/mock-test/2026/set-1/question-9",
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

  it("verifies HEAD markdown requests before rewriting", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/mathematics/integral/area-of-a-flat-surface.md",
        {
          method: "HEAD",
        }
      )
    );

    expect(mockGetRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route: "material/lesson/mathematics/integral/area-of-a-flat-surface",
    });
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/subjects/mathematics/integral/area-of-a-flat-surface"
    );
  });

  it("rewrites non-read markdown requests without runtime probes", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/mathematics/integral/area-of-a-flat-surface.md",
        {
          method: "POST",
        }
      )
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/subjects/mathematics/integral/area-of-a-flat-surface"
    );
  });

  it("delegates html public content routes to the app tree", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/id/materi/kimia/kimia-hijau/pengertian-kimia-hijau"
      )
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates Quran html routes to the app tree", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest("http://localhost:3000/id/quran/999")
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates html content HEAD requests to the app tree", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/articles/politics/nepotism-in-political-governance-afdocs-nonexistent-8f3a",
        {
          method: "HEAD",
        }
      )
    );

    expect(mockGetRuntimeContentRoute).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates article listing html routes to the app tree", async () => {
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

    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates supported article category html routes to the app tree", async () => {
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

    expect(mockGetRuntimeContentRouteParentPage).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("returns a real 404 for unmatched curriculum app routes", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns a real 404 for unmatched curriculum material app routes", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/curriculum/merdeka/class-10/mathematics-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("delegates unmatched assessment app routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/exams/snbt/general-reasoning-afdocs-nonexistent-8f3a"
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
        "http://localhost:3000/en/articles/politics/dynastic-politics-asian-values",
        {
          headers: {
            accept: "text/markdown",
          },
        }
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/articles/politics/dynastic-politics-asian-values"
    );
  });

  it("fails open when a listing route probe is temporarily unavailable", async () => {
    mockGetRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.fail(new Error("Convex unavailable"))
    );

    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles/politics", {
        headers: {
          accept: "text/markdown",
        },
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/articles/politics"
    );
  });

  it("returns a real 404 when a markdown listing route has no rows", async () => {
    mockGetRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [],
      })
    );

    const response = await proxy(
      new NextRequest("http://localhost:3000/en/articles/politics", {
        headers: {
          accept: "text/markdown",
        },
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
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
        "http://localhost:3000/en/practice/snbt/general-knowledge/mock-test/2026/set-1/question-9.md"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/practice/snbt/general-knowledge/mock-test/2026/set-1/question-9"
    );
  });

  it("delegates assessment routes that are not material content", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/exams/snbt/general-knowledge/mock-test/2026"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });
});
