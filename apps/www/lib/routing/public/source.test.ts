// @vitest-environment node

import { Data, Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";

const publishedMocks = vi.hoisted(() => ({
  hasArticleCategory: vi.fn(),
  readActiveContentIdentity: vi.fn(),
  readActiveContentRoute: vi.fn(),
}));
const previewMocks = vi.hoisted(() => ({
  matchesPreviewRoute: vi.fn(),
}));

/** Test-only typed publication lookup failure. */
class TestPublishedRouteError extends Data.TaggedError(
  "TestPublishedRouteError"
)<{
  readonly message: string;
}> {}

vi.mock("@/lib/content/article/category", () => ({
  hasPublishedArticleCategory: publishedMocks.hasArticleCategory,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: publishedMocks.readActiveContentIdentity,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: publishedMocks.readActiveContentRoute,
}));
vi.mock("@/lib/content/preview/route", () => ({
  matchesPreviewRoute: previewMocks.matchesPreviewRoute,
}));

describe("public HTML route rejection", () => {
  beforeEach(() => {
    publishedMocks.hasArticleCategory.mockReset();
    publishedMocks.hasArticleCategory.mockReturnValue(Effect.succeed(true));
    publishedMocks.readActiveContentIdentity.mockReset();
    publishedMocks.readActiveContentIdentity.mockReturnValue(
      Effect.succeed({ releaseId: "release-active" })
    );
    publishedMocks.readActiveContentRoute.mockReset();
    publishedMocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-active",
        kind: "found",
      })
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
          readSourceBackedHtmlRouteRejection({ method: "GET", pathname })
        )
      ).resolves.toBe(locale);
    }
  });

  it("rejects impossible Quran and article HTML paths", async () => {
    const paths = [
      "/id/quran/999",
      "/id/quran/abc",
      "/id/quran/01",
      "/id/quran/1/extra",
      "/en/articles/Invalid_Category",
      "/en/articles/politics/Invalid_Slug",
      "/en/articles/politics/article/extra",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(
          readSourceBackedHtmlRouteRejection({ method: "GET", pathname })
        )
      ).resolves.toBe(pathname.startsWith("/id/") ? "id" : "en");
    }
  });

  it("accepts signed articles and rejects missing or unmanaged routes", async () => {
    publishedMocks.readActiveContentRoute
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "found",
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "missing",
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "unmanaged",
        })
      );

    const paths = [
      "/en/articles/public-affairs/new-article",
      "/en/articles/public-affairs/deleted-article",
      "/en/articles/public-affairs/unmanaged-article",
    ];
    const results = await Promise.all(
      paths.map((pathname) =>
        Effect.runPromise(
          readSourceBackedHtmlRouteRejection({ method: "GET", pathname })
        )
      )
    );

    expect(results).toEqual([null, "en", "en"]);
    expect(publishedMocks.readActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId: "release-active",
      appLocale: "en",
      family: "article",
      publicPath: "articles/public-affairs/new-article",
    });
  });

  it("accepts the exact selected local preview before publication lookup", async () => {
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
      appLocale: "en",
      publicPath: "articles/public-affairs/new-preview",
    });
    expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
    expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
  });

  it("rejects article details when no active publication exists", async () => {
    publishedMocks.readActiveContentIdentity.mockReturnValueOnce(
      Effect.succeed(null)
    );
    publishedMocks.readActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
    );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/public-affairs/unmanaged-article",
        })
      )
    ).resolves.toBe("en");
    expect(publishedMocks.readActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId: null,
      appLocale: "en",
      family: "article",
      publicPath: "articles/public-affairs/unmanaged-article",
    });
  });

  it("uses exact signed ownership for category pages", async () => {
    publishedMocks.hasArticleCategory
      .mockReturnValueOnce(Effect.succeed(true))
      .mockReturnValueOnce(Effect.succeed(false));

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

  it("propagates signed article lookup failures", async () => {
    publishedMocks.readActiveContentRoute.mockReturnValueOnce(
      Effect.fail(
        new TestPublishedRouteError({ message: "publication unavailable" })
      )
    );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname: "/en/articles/politics/published-article",
        })
      )
    ).rejects.toThrow("publication unavailable");
  });

  it("delegates indexes, markdown, and non-read requests", async () => {
    const requests = [
      { method: "GET", pathname: "/id/quran" },
      { method: "GET", pathname: "/en/articles" },
      { method: "GET", pathname: "/id/quran/1.md" },
      {
        method: "GET",
        pathname: "/en/articles/politics/published-article.md",
      },
      { method: "POST", pathname: "/en/articles/politics/not-a-read-check" },
    ];

    for (const request of requests) {
      await expect(
        Effect.runPromise(readSourceBackedHtmlRouteRejection(request))
      ).resolves.toBeNull();
    }
    expect(publishedMocks.hasArticleCategory).not.toHaveBeenCalled();
    expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
  });
});
