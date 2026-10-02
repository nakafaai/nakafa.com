// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Effect, Layer } from "effect";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { makeMaterialRuntimeSource } from "@/test/content/material";

const readNakafaRuntimeQueryMock = vi.hoisted(() => vi.fn());
const articleMocks = vi.hoisted(() => ({
  hasCategory: vi.fn(),
  readActiveRoute: vi.fn(),
}));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: readNakafaRuntimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
vi.mock("@/lib/content/article/category", () => ({
  hasPublishedArticleCategory: articleMocks.hasCategory,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: articleMocks.readActiveRoute,
}));
const readTryoutSectionRedirectMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/routing/public/tryout", () => ({
  readTryoutSectionRedirect: readTryoutSectionRedirectMock,
}));
describe("public URL migration redirects", () => {
  beforeEach(() => {
    readNakafaRuntimeQueryMock.mockReset();
    articleMocks.hasCategory.mockReset();
    articleMocks.readActiveRoute.mockReset();
    readTryoutSectionRedirectMock.mockReset();
    readTryoutSectionRedirectMock.mockReturnValue(Effect.succeed(null));
  });
  it.effect("redirects a retired try-out section to its live successor", () =>
    Effect.gen(function* () {
      const successor =
        "/id/try-out/indonesia/snbt/2027/set-1/literasi-dalam-bahasa-inggris";
      readTryoutSectionRedirectMock.mockReturnValueOnce(
        Effect.succeed(successor)
      );
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "GET",
        pathname: "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris",
      });
      expect(redirect).toBe(successor);
      expect(readNakafaRuntimeQueryMock).not.toHaveBeenCalled();
    })
  );
  it.effect("keeps a try-out attempt on the route it was frozen to", () =>
    Effect.gen(function* () {
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: true,
        method: "GET",
        pathname: "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris",
      });
      expect(redirect).toBeNull();
      expect(readTryoutSectionRedirectMock).not.toHaveBeenCalled();
    })
  );
  it.effect("redirects a retired URL to its authenticated current route", () =>
    Effect.gen(function* () {
      readNakafaRuntimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-test",
          managed: true,
          publicPath:
            "materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling",
        })
      );
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "GET",
        pathname:
          "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
      });
      expect(redirect).toBe(
        "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling"
      );
      expect(readNakafaRuntimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          appLocale: "id",
          contentKey:
            "material/lesson/mathematics/circle/central-angle-and-inscribed-angle",
          expectedMaterialKey: "lesson.mathematics.circle",
          expectedSectionKey: "central-angle-and-inscribed-angle",
        }
      );
    })
  );
  it.effect(
    "resolves historical material URLs against authenticated snapshot ownership",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        readNakafaRuntimeQueryMock.mockImplementation(context.query);
        expect(
          yield* readPublicUrlMigrationRedirect({
            hasAttemptCapability: false,
            method: "GET",
            pathname:
              "/id/subject/high-school/11/mathematics/technical-topic/section-1",
          })
        ).toBe("/id/materi/mathematics/teknis-topic/section-1");
        expect(
          yield* readPublicUrlMigrationRedirect({
            hasAttemptCapability: false,
            method: "GET",
            pathname:
              "/id/subject/high-school/11/mathematics/technical-topic/missing-section",
          })
        ).toBeNull();
      })
  );
  it.effect.each([
    {
      expectedIdentity: {
        appLocale: "id",
        contentKey:
          "material/lesson/mathematics/statistics-foundations/histogram",
        expectedMaterialKey: "lesson.mathematics.statistics-foundations",
        expectedSectionKey: "histogram",
      },
      pathname: "/id/subject/high-school/10/mathematics/statistics/histogram",
      publicPath: "materi/matematika/statistika-dasar/histogram",
    },
    {
      expectedIdentity: {
        appLocale: "en",
        contentKey:
          "material/lesson/mathematics/statistics-regression/scatter-diagram",
        expectedMaterialKey: "lesson.mathematics.statistics-regression",
        expectedSectionKey: "scatter-diagram",
      },
      pathname:
        "/en/subject/high-school/11/mathematics/statistics/scatter-diagram",
      publicPath: "subjects/mathematics/statistics-regression/scatter-diagram",
    },
  ])(
    "redirects the source-proven statistics topic split for $pathname",
    ({ expectedIdentity, pathname, publicPath }) =>
      Effect.gen(function* () {
        readNakafaRuntimeQueryMock.mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "release-test",
            managed: true,
            publicPath,
          })
        );
        const redirect = yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          method: "GET",
          pathname,
        });
        expect(redirect).toBe(`/${expectedIdentity.appLocale}/${publicPath}`);
        expect(readNakafaRuntimeQueryMock).toHaveBeenCalledWith(
          expect.anything(),
          expectedIdentity
        );
      })
  );
  it.effect.each([
    ["/de/articles/politics", "/de/articles/politik"],
    [
      "/de/articles/politics/regional-elections-turmoil",
      "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen",
    ],
    [
      "/de/articles/politics/pork-barrel-politics-power",
      "/de/articles/politik/sozialhilfe-und-wahlpolitische-anreize",
    ],
    [
      "/de/articles/politics/nepotism-in-political-governance",
      "/de/articles/politik/nepotismus-und-politische-verantwortung",
    ],
    [
      "/de/articles/politics/merah-putih-cabinet-analysis",
      "/de/articles/politik/kabinett-merah-putih-und-koalitionspolitik",
    ],
    [
      "/de/articles/politics/kim-plus-empty-box",
      "/de/articles/politik/kim-plus-und-das-leere-feld",
    ],
    [
      "/de/articles/politics/flawed-legal-geopolitics",
      "/de/articles/politik/nusantara-rechtsgrundlage-und-sicherheit",
    ],
    [
      "/de/articles/politics/dynastic-politics-asian-values",
      "/de/articles/politik/politische-dynastien-und-asiatische-werte",
    ],
  ])("redirects exposed German article URL %s", ([pathname, expected]) =>
    Effect.gen(function* () {
      articleMocks.hasCategory
        .mockReturnValueOnce(Effect.succeed(false))
        .mockReturnValueOnce(Effect.succeed(true));
      articleMocks.readActiveRoute
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "release-current",
            kind: "missing",
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "release-current",
            kind: "found",
          })
        );
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "GET",
        pathname,
      });
      expect(redirect).toBe(expected);
      expect(readNakafaRuntimeQueryMock).not.toHaveBeenCalled();
    })
  );
  it.effect("redirects HEAD requests for an exposed article category", () =>
    Effect.gen(function* () {
      articleMocks.hasCategory
        .mockReturnValueOnce(Effect.succeed(false))
        .mockReturnValueOnce(Effect.succeed(true));
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "HEAD",
        pathname: "/de/articles/politics",
      });
      expect(redirect).toBe("/de/articles/politik");
    })
  );
  it.effect("keeps article routes owned by a recovered signed release", () =>
    Effect.gen(function* () {
      articleMocks.readActiveRoute
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "release-recovery",
            kind: "found",
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "release-recovery",
            kind: "missing",
          })
        );
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "GET",
        pathname: "/de/articles/politics/regional-elections-turmoil",
      });
      expect(redirect).toBeNull();
    })
  );
  it.effect("keeps category routes owned by a recovered signed release", () =>
    Effect.gen(function* () {
      articleMocks.hasCategory
        .mockReturnValueOnce(Effect.succeed(true))
        .mockReturnValueOnce(Effect.succeed(false));
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "HEAD",
        pathname: "/de/articles/politics",
      });
      expect(redirect).toBeNull();
    })
  );
  it.effect(
    "does not redirect an article without active signed ownership",
    () =>
      Effect.gen(function* () {
        articleMocks.readActiveRoute.mockReturnValue(
          Effect.succeed({
            activeReleaseId: null,
            kind: "unmanaged",
          })
        );
        const redirect = yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          method: "GET",
          pathname: "/de/articles/politics/regional-elections-turmoil",
        });
        expect(redirect).toBeNull();
        expect(articleMocks.readActiveRoute).toHaveBeenCalledTimes(2);
      })
  );
  it.effect.each([
    {
      previousId: "release-previous",
      previousKind: "missing",
      successorId: "release-next",
      successorKind: "found",
    },
    {
      previousId: null,
      previousKind: "unmanaged",
      successorId: "release-next",
      successorKind: "missing",
    },
    {
      previousId: "release-previous",
      previousKind: "found",
      successorId: null,
      successorKind: "unmanaged",
    },
  ])("rejects redirect reads spanning different publications", (state) =>
    Effect.gen(function* () {
      articleMocks.readActiveRoute
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: state.previousId,
            kind: state.previousKind,
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: state.successorId,
            kind: state.successorKind,
          })
        );
      expect(
        yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          method: "GET",
          pathname: "/de/articles/politics/regional-elections-turmoil",
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: state.successorId,
        expectedReleaseId: state.previousId,
      });
      expect(articleMocks.readActiveRoute).toHaveBeenCalledTimes(2);
    })
  );
  it.effect.each([
    {
      activeReleaseId: "release-test",
      managed: true,
      publicPath: null,
    },
    {
      activeReleaseId: null,
      managed: false,
      publicPath: null,
    },
    {
      activeReleaseId: null,
      managed: true,
      publicPath: "subjects/mathematics/circle/section",
    },
  ])("does not redirect an absent signed identity", (decision) =>
    Effect.gen(function* () {
      readNakafaRuntimeQueryMock.mockReturnValueOnce(Effect.succeed(decision));
      const redirect = yield* readPublicUrlMigrationRedirect({
        hasAttemptCapability: false,
        method: "HEAD",
        pathname:
          "/en/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
      });
      expect(redirect).toBeNull();
    })
  );
  it.effect.each([
    {
      hasAttemptCapability: false,
      method: "POST",
      pathname:
        "/en/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
    },
    {
      hasAttemptCapability: false,
      method: "POST",
      pathname: "/de/articles/politics",
    },
    {
      hasAttemptCapability: false,
      method: "GET",
      pathname:
        "/fr/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
    },
    {
      hasAttemptCapability: false,
      method: "GET",
      pathname:
        "/de/subject/high-school/11/mathematics/statistics/scatter-diagram",
    },
    {
      hasAttemptCapability: false,
      method: "GET",
      pathname:
        "/en/subject/high-school/9/mathematics/statistics/scatter-diagram",
    },
    {
      hasAttemptCapability: false,
      method: "GET",
      pathname: "/en/subject/high-school/11/mathematics/circle",
    },
    {
      hasAttemptCapability: false,
      method: "GET",
      pathname:
        "/en/subject/high-school/11/mathematics/circle/central-angle/extra",
    },
    {
      hasAttemptCapability: false,
      method: "GET",
      pathname: "/en/subject/high-school/11/mathematics/circle/NotAContentKey",
    },
  ])("ignores a non-migration request", (request) =>
    Effect.gen(function* () {
      const redirect = yield* readPublicUrlMigrationRedirect(request);
      expect(redirect).toBeNull();
      expect(readNakafaRuntimeQueryMock).not.toHaveBeenCalled();
      expect(articleMocks.hasCategory).not.toHaveBeenCalled();
    })
  );
});
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
