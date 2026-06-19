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

vi.mock("@/lib/content/runtime/routes", () => ({
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

  it("rewrites markdown requests through the llms route adapter", async () => {
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

  it("lets explicit markdown suffixes reach the llms route adapter", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/quran/1.md")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/quran/1"
    );
  });

  it("returns real 404 responses for unsupported markdown requests", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/mathematics/integral/area-of-a-flat-surface.md"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(mockGetRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route: "subjects/mathematics/integral/area-of-a-flat-surface",
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
  });

  it("returns real 404 responses for invalid finite source-backed HTML routes", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/id/quran/999")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/id/_not-found"
    );
  });

  it("returns real 404 responses for non-rendered projected HTML routes", async () => {
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
});
