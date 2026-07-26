// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRoute: vi.fn(),
}));
const publishedMocks = vi.hoisted(() => ({
  readActiveContentIdentity: vi.fn(),
  readActiveContentRoute: vi.fn(),
  readPublishedArticleCategory: vi.fn(),
}));
const previewMocks = vi.hoisted(() => ({
  matchesPreviewRoute: vi.fn(),
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.getRuntimeContentRoute,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: publishedMocks.readActiveContentIdentity,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: publishedMocks.readActiveContentRoute,
}));
vi.mock("@/lib/content/article/ownership", () => ({
  readPublishedArticleCategory: publishedMocks.readPublishedArticleCategory,
}));
vi.mock("@/lib/content/preview/route", () => ({
  matchesPreviewRoute: previewMocks.matchesPreviewRoute,
}));

describe("source-backed public html route rejection", () => {
  beforeEach(() => {
    runtimeMocks.getRuntimeContentRoute.mockReset();
    runtimeMocks.getRuntimeContentRoute.mockReturnValue(
      Effect.succeed({ kind: "article", route: "fixture" })
    );
    publishedMocks.readActiveContentIdentity.mockReset();
    publishedMocks.readActiveContentIdentity.mockReturnValue(
      Effect.succeed({ releaseId: "release-active" })
    );
    publishedMocks.readActiveContentRoute.mockReset();
    publishedMocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-active",
        kind: "unmanaged",
      })
    );
    publishedMocks.readPublishedArticleCategory.mockReset();
    publishedMocks.readPublishedArticleCategory.mockReturnValue(
      Effect.succeed({ exists: false, managed: false })
    );
    previewMocks.matchesPreviewRoute.mockReset();
    previewMocks.matchesPreviewRoute.mockReturnValue(Effect.succeed(false));
  });

  it("rejects stale public namespaces and invisible route groups", async () => {
    const paths = [
      ["/id/curricula/merdeka", "id"],
      ["/id/subjects/matematika/integral", "id"],
      ["/en/kurikulum/merdeka/kelas-10", "en"],
      ["/en/materi/mathematics/integral", "en"],
      ["/learn", "en"],
    ] as const;

    for (const [pathname, locale] of paths) {
      await expect(
        Effect.runPromise(
          readSourceBackedHtmlRouteRejection({
            method: "GET",
            pathname,
          })
        )
      ).resolves.toBe(locale);
    }
  });

  it("rejects impossible Quran and article HTML paths before app rendering", async () => {
    const paths = [
      "/id/quran/999",
      "/id/quran/abc",
      "/id/quran/01",
      "/id/quran/1/extra",
      "/en/articles/Invalid_Category",
      "/en/articles/politics/Invalid_Slug",
      "/en/articles/politics/nepotism-in-political-governance/extra",
      "/en/articles/politics-afdocs-nonexistent-8f3a",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(
          readSourceBackedHtmlRouteRejection({
            method: "GET",
            pathname,
          })
        )
      ).resolves.toBe(pathname.startsWith("/id/") ? "id" : "en");
    }
  });

  it("uses the runtime route catalog for exact article detail HTML paths", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname:
            "/en/articles/politics/nepotism-in-political-governance-afdocs-nonexistent-8f3a",
        })
      )
    ).resolves.toBe("en");
    expect(runtimeMocks.getRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route:
        "articles/politics/nepotism-in-political-governance-afdocs-nonexistent-8f3a",
    });

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname: "/en/articles/politics/nepotism-in-political-governance",
        })
      )
    ).resolves.toBe(null);

    publishedMocks.readActiveContentIdentity.mockReturnValueOnce(
      Effect.succeed(null)
    );
    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/politics/source-owned-article",
        })
      )
    ).resolves.toBeNull();
    expect(publishedMocks.readActiveContentRoute).toHaveBeenLastCalledWith({
      activeReleaseId: null,
      family: "article",
      locale: "en",
      publicPath: "articles/politics/source-owned-article",
    });
  });

  it("accepts published-only articles and rejects active tombstones", async () => {
    publishedMocks.readActiveContentRoute
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "found",
          rendererDomain: "politics",
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "missing",
        })
      );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/public-affairs/new-article",
        })
      )
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/public-affairs/deleted-article",
        })
      )
    ).resolves.toBe("en");
    expect(runtimeMocks.getRuntimeContentRoute).not.toHaveBeenCalled();
  });

  it("accepts the exact selected local article before persistent lookup", async () => {
    previewMocks.matchesPreviewRoute.mockReturnValueOnce(Effect.succeed(true));

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/public-affairs/new-preview",
        })
      )
    ).resolves.toBeNull();
    expect(previewMocks.matchesPreviewRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "articles/public-affairs/new-preview",
    });
    expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
    expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
    expect(runtimeMocks.getRuntimeContentRoute).not.toHaveBeenCalled();
  });

  it("uses exact ownership for published-only category pages", async () => {
    publishedMocks.readPublishedArticleCategory
      .mockReturnValueOnce(Effect.succeed({ exists: true, managed: true }))
      .mockReturnValueOnce(Effect.succeed({ exists: false, managed: true }));

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/public-affairs",
        })
      )
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/deleted-category",
        })
      )
    ).resolves.toBe("en");
  });

  it("propagates exact article lookup failures", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("runtime unavailable"))
    );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname: "/en/articles/politics/nepotism-in-political-governance",
        })
      )
    ).rejects.toThrow("runtime unavailable");
  });

  it("delegates source-backed index, category, and non-read paths", async () => {
    const requests = [
      { method: "GET", pathname: "/id/quran" },
      { method: "GET", pathname: "/en/articles" },
      { method: "GET", pathname: "/en/articles/politics" },
      { method: "GET", pathname: "/id/quran/1.md" },
      {
        method: "GET",
        pathname: "/en/articles/politics/nepotism-in-political-governance.md",
      },
      { method: "POST", pathname: "/en/articles/politics/not-a-read-check" },
    ];

    for (const request of requests) {
      await expect(
        Effect.runPromise(readSourceBackedHtmlRouteRejection(request))
      ).resolves.toBe(null);
    }
    expect(runtimeMocks.getRuntimeContentRoute).not.toHaveBeenCalled();
    expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
    expect(publishedMocks.readPublishedArticleCategory).toHaveBeenCalledWith(
      "politics",
      "en"
    );
  });
});
