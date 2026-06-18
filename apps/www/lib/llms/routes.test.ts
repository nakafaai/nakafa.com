// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLlmsProxyRoute } from "@/lib/llms/routes";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRoute: vi.fn(),
  getRuntimeContentRouteParentPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.getRuntimeContentRoute,
  getRuntimeContentRouteParentPage:
    runtimeMocks.getRuntimeContentRouteParentPage,
}));

describe("llms proxy route resolver", () => {
  beforeEach(() => {
    runtimeMocks.getRuntimeContentRoute.mockReset();
    runtimeMocks.getRuntimeContentRouteParentPage.mockReset();
    runtimeMocks.getRuntimeContentRoute.mockReturnValue(
      Effect.succeed({ route: "fixture" })
    );
    runtimeMocks.getRuntimeContentRouteParentPage.mockReturnValue(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [{ route: "fixture" }],
      })
    );
  });

  it("rejects markdown taxonomy routes that cannot map to content rows", async () => {
    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: null,
          method: "GET",
          pathname: "/en/articles/not-a-category.md",
        })
      )
    ).resolves.toEqual({ kind: "content-not-found", locale: "en" });
  });

  it("delegates invalid non-Nakafa markdown-looking paths after typed route decode failure", async () => {
    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: null,
          method: "GET",
          pathname: "/en/Subjects.md",
        })
      )
    ).resolves.toEqual({ kind: "delegate" });
  });

  it("rewrites exact public content routes when markdown is requested", async () => {
    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: "text/markdown, text/plain;q=0.8",
          method: "GET",
          pathname: "/en/subjects/mathematics/integral/area-of-a-flat-surface",
        })
      )
    ).resolves.toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: "",
        route: "/subjects/mathematics/integral/area-of-a-flat-surface",
      },
    });
    expect(runtimeMocks.getRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route: "subjects/mathematics/integral/area-of-a-flat-surface",
    });
  });

  it("rewrites source-backed app routes without runtime row probes", async () => {
    const requests = [
      "/en/terms-of-service",
      "/en/search",
      "/en/contributor.md",
      "/en/articles.md",
    ];

    for (const pathname of requests) {
      await expect(
        Effect.runPromise(
          resolveLlmsProxyRoute({
            acceptHeader: pathname.endsWith(".md") ? null : "text/markdown",
            method: "GET",
            pathname,
          })
        )
      ).resolves.toMatchObject({ kind: "rewrite-markdown" });
    }

    expect(runtimeMocks.getRuntimeContentRoute).not.toHaveBeenCalled();
    expect(
      runtimeMocks.getRuntimeContentRouteParentPage
    ).not.toHaveBeenCalled();
  });

  it("rejects exact markdown pages when the runtime route cannot prove them", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("runtime unavailable"))
    );

    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: null,
          method: "GET",
          pathname:
            "/en/subjects/mathematics/integral/area-of-a-flat-surface.md",
        })
      )
    ).resolves.toEqual({ kind: "content-not-found", locale: "en" });
  });

  it("checks listing markdown routes through one bounded runtime page", async () => {
    runtimeMocks.getRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.succeed({
        continueCursor: null,
        isDone: true,
        page: [],
      })
    );

    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: "text/markdown",
          method: "GET",
          pathname: "/en/articles/politics",
        })
      )
    ).resolves.toEqual({ kind: "content-not-found", locale: "en" });
    expect(runtimeMocks.getRuntimeContentRouteParentPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "article",
      limit: 1,
      locale: "en",
      order: "date-desc",
      parentRoute: "articles/politics",
      section: "articles",
    });
  });

  it("fails closed when listing markdown route probes are unavailable", async () => {
    runtimeMocks.getRuntimeContentRouteParentPage.mockReturnValueOnce(
      Effect.fail(new Error("runtime unavailable"))
    );

    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: "text/markdown",
          method: "GET",
          pathname: "/en/articles/politics",
        })
      )
    ).resolves.toEqual({ kind: "content-not-found", locale: "en" });
  });

  it("rewrites non-read markdown methods without runtime probes", async () => {
    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: null,
          method: "POST",
          pathname:
            "/en/subjects/mathematics/integral/area-of-a-flat-surface.md",
        })
      )
    ).resolves.toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: ".md",
        route: "/subjects/mathematics/integral/area-of-a-flat-surface",
      },
    });
    expect(runtimeMocks.getRuntimeContentRoute).not.toHaveBeenCalled();
  });

  it("preserves markdown alternates for real practice question routes", async () => {
    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: null,
          method: "GET",
          pathname:
            "/en/practice/snbt/general-knowledge/mock-test/2026/set-1/question-9.md",
        })
      )
    ).resolves.toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: ".md",
        route:
          "/practice/snbt/general-knowledge/mock-test/2026/set-1/question-9",
      },
    });
  });

  it("does not serve locale home markdown from the llms index", async () => {
    await expect(
      Effect.runPromise(
        resolveLlmsProxyRoute({
          acceptHeader: "text/markdown",
          method: "GET",
          pathname: "/en.md",
        })
      )
    ).resolves.toEqual({ kind: "delegate" });
  });
});
