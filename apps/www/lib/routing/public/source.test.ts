// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
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

  it.effect("rejects stale public namespaces and invisible route groups", () =>
    Effect.gen(function* () {
      const paths = [
        ["/id/curricula/merdeka", "id"],
        ["/id/subjects/matematika/integral", "id"],
        ["/en/kurikulum/merdeka/kelas-10", "en"],
        ["/en/materi/mathematics/integral", "en"],
        ["/learn", "en"],
      ] as const;

      for (const [pathname, locale] of paths) {
        const rejection = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname,
        });
        expect(rejection).toBe(locale);
      }
    })
  );

  it.effect("rejects impossible Quran and article HTML paths", () =>
    Effect.gen(function* () {
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
        const rejection = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname,
        });
        expect(rejection).toBe(pathname.startsWith("/id/") ? "id" : "en");
      }
    })
  );

  it.effect(
    "accepts signed articles and rejects missing or unmanaged routes",
    () =>
      Effect.gen(function* () {
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
        const results = yield* Effect.all(
          paths.map((pathname) =>
            readSourceBackedHtmlRouteRejection({ method: "GET", pathname })
          ),
          { concurrency: "unbounded" }
        );

        expect(results).toEqual([null, "en", "en"]);
        expect(publishedMocks.readActiveContentRoute).toHaveBeenCalledWith({
          activeReleaseId: "release-active",
          appLocale: "en",
          family: "article",
          publicPath: "articles/public-affairs/new-article",
        });
      })
  );

  it.effect(
    "accepts signed Pages and rejects missing or unmanaged Page routes",
    () =>
      Effect.gen(function* () {
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

        const found = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/de/impressum",
        });
        const missing = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/de/fabricated-page",
        });
        const unmanaged = yield* readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname: "/en/missing/page",
        });

        expect(found).toBeNull();
        expect(missing).toBe("de");
        expect(unmanaged).toBe("en");
        expect(publishedMocks.readActiveContentRoute).toHaveBeenNthCalledWith(
          1,
          {
            activeReleaseId: "release-active",
            appLocale: "de",
            family: "page",
            publicPath: "impressum",
          }
        );
      })
  );

  it.effect(
    "accepts the exact selected local preview before publication lookup",
    () =>
      Effect.gen(function* () {
        previewMocks.matchesPreviewRoute.mockReturnValueOnce(
          Effect.succeed(true)
        );

        const rejection = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/en/articles/public-affairs/new-preview",
        });
        expect(rejection).toBeNull();
        expect(previewMocks.matchesPreviewRoute).toHaveBeenCalledWith({
          appLocale: "en",
          publicPath: "articles/public-affairs/new-preview",
        });
        expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
        expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "accepts the exact selected Page preview before publication lookup",
    () =>
      Effect.gen(function* () {
        previewMocks.matchesPreviewRoute.mockReturnValueOnce(
          Effect.succeed(true)
        );

        const rejection = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname: "/de/neue-rechtliche-seite",
        });
        expect(rejection).toBeNull();
        expect(previewMocks.matchesPreviewRoute).toHaveBeenCalledWith({
          appLocale: "de",
          publicPath: "neue-rechtliche-seite",
        });
        expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
        expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
      })
  );

  it.effect("rejects article details when no active publication exists", () =>
    Effect.gen(function* () {
      publishedMocks.readActiveContentIdentity.mockReturnValueOnce(
        Effect.succeed(null)
      );
      publishedMocks.readActiveContentRoute.mockReturnValueOnce(
        Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
      );

      const rejection = yield* readSourceBackedHtmlRouteRejection({
        method: "GET",
        pathname: "/en/articles/public-affairs/unmanaged-article",
      });
      expect(rejection).toBe("en");
      expect(publishedMocks.readActiveContentRoute).toHaveBeenCalledWith({
        activeReleaseId: null,
        appLocale: "en",
        family: "article",
        publicPath: "articles/public-affairs/unmanaged-article",
      });
    })
  );

  it.effect("uses exact signed ownership for category pages", () =>
    Effect.gen(function* () {
      publishedMocks.hasArticleCategory
        .mockReturnValueOnce(Effect.succeed(true))
        .mockReturnValueOnce(Effect.succeed(false));

      const found = yield* readSourceBackedHtmlRouteRejection({
        method: "GET",
        pathname: "/en/articles/public-affairs",
      });
      const missing = yield* readSourceBackedHtmlRouteRejection({
        method: "GET",
        pathname: "/en/articles/deleted-category",
      });

      expect(found).toBeNull();
      expect(missing).toBe("en");
    })
  );

  it.effect("propagates signed article lookup failures", () =>
    Effect.gen(function* () {
      publishedMocks.readActiveContentRoute.mockReturnValueOnce(
        Effect.fail(
          new TestPublishedRouteError({ message: "publication unavailable" })
        )
      );

      const failure = yield* readSourceBackedHtmlRouteRejection({
        method: "HEAD",
        pathname: "/en/articles/politics/published-article",
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "TestPublishedRouteError",
        message: "publication unavailable",
      });
    })
  );

  it.effect("delegates indexes, markdown, and non-read requests", () =>
    Effect.gen(function* () {
      const requests = [
        { method: "GET", pathname: "/id/quran" },
        { method: "GET", pathname: "/en/articles" },
        { method: "GET", pathname: "/id/quran/1.md" },
        {
          method: "GET",
          pathname: "/en/articles/politics/published-article.md",
        },
        { method: "GET", pathname: "/de/datenschutz.md" },
        {
          method: "POST",
          pathname: "/en/articles/politics/not-a-read-check",
        },
      ];

      for (const request of requests) {
        const rejection = yield* readSourceBackedHtmlRouteRejection(request);
        expect(rejection).toBeNull();
      }
      expect(publishedMocks.hasArticleCategory).not.toHaveBeenCalled();
      expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
    })
  );

  it.effect("delegates concrete application roots without Page lookups", () =>
    Effect.gen(function* () {
      const paths = [
        "/de",
        "/de/pricing",
        "/de/search",
        "/de/chat/new",
        "/de/lehrplaene/merdeka",
        "/de/faecher/mathematik/algebra",
        "/de/try-out/indonesien/snbt",
        "/en/school/onboarding",
      ];

      for (const pathname of paths) {
        const rejection = yield* readSourceBackedHtmlRouteRejection({
          method: "GET",
          pathname,
        });
        expect(rejection).toBeNull();
      }
      expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
      expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects invalid descendants inside reserved application roots",
    () =>
      Effect.gen(function* () {
        const paths = [
          "/de/search/fabricated",
          "/de/pricing/fabricated",
          "/de/auth/fabricated",
          "/de/onboarding/fabricated",
          "/de/home/fabricated",
          "/de/contributor/fabricated",
          "/de/user",
          "/de/user/settings/fabricated",
          "/en/school/select/fabricated",
          "/de/og",
          "/de/faecher",
          "/en/subjects/mathematics",
          "/de/try-out/a/b/c/d/e/f",
        ];

        for (const pathname of paths) {
          const rejection = yield* readSourceBackedHtmlRouteRejection({
            method: "GET",
            pathname,
          });
          expect(rejection).toBe(pathname.startsWith("/en/") ? "en" : "de");
        }
        expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
        expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
      })
  );

  it.effect("rejects malformed Page paths without a publication lookup", () =>
    Effect.gen(function* () {
      const rejection = yield* readSourceBackedHtmlRouteRejection({
        method: "GET",
        pathname: "/de/Invalid_Page",
      });
      expect(rejection).toBe("de");
      expect(publishedMocks.readActiveContentIdentity).not.toHaveBeenCalled();
      expect(publishedMocks.readActiveContentRoute).not.toHaveBeenCalled();
    })
  );
});
