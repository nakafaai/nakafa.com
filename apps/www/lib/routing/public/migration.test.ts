// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { createTestSnapshotQuery } from "@/test/runtime-query";

const readRuntimeQueryMock = vi.hoisted(() => vi.fn());
const articleMocks = vi.hoisted(() => ({
  hasCategory: vi.fn(),
  readActiveIdentity: vi.fn(),
  readActiveRoute: vi.fn(),
}));

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readRuntimeQueryMock,
}));
vi.mock("@/lib/content/article/category", () => ({
  hasPublishedArticleCategory: articleMocks.hasCategory,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: articleMocks.readActiveIdentity,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: articleMocks.readActiveRoute,
}));

describe("public URL migration redirects", () => {
  beforeEach(() => {
    readRuntimeQueryMock.mockReset();
    articleMocks.hasCategory.mockReset();
    articleMocks.readActiveIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: "release-current" }));
    articleMocks.readActiveRoute.mockReset();
  });

  it.effect("redirects a retired URL to its authenticated current route", () =>
    Effect.gen(function* () {
      readRuntimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-test",
          managed: true,
          publicPath:
            "materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling",
        })
      );

      const redirect = yield* readPublicUrlMigrationRedirect({
        method: "GET",
        pathname:
          "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
      });
      expect(redirect).toBe(
        "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling"
      );
      expect(readRuntimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          appLocale: "id",
          contentKey:
            "material/lesson/mathematics/circle/central-angle-and-inscribed-angle",
          expectedMaterialKey: "lesson.mathematics.circle",
          expectedSectionKey: "central-angle-and-inscribed-angle",
        },
        expect.any(Function)
      );
    })
  );

  it.effect(
    "resolves historical material URLs against authenticated snapshot ownership",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        readRuntimeQueryMock.mockImplementation(
          createTestSnapshotQuery(context)
        );

        expect(
          yield* readPublicUrlMigrationRedirect({
            method: "GET",
            pathname:
              "/id/subject/high-school/11/mathematics/technical-topic/section-1",
          })
        ).toBe("/id/materi/mathematics/teknis-topic/section-1");
        expect(
          yield* readPublicUrlMigrationRedirect({
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
        readRuntimeQueryMock.mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId: "release-test",
            managed: true,
            publicPath,
          })
        );

        const redirect = yield* readPublicUrlMigrationRedirect({
          method: "GET",
          pathname,
        });
        expect(redirect).toBe(`/${expectedIdentity.appLocale}/${publicPath}`);
        expect(readRuntimeQueryMock).toHaveBeenCalledWith(
          expect.anything(),
          expectedIdentity,
          expect.any(Function)
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
        method: "GET",
        pathname,
      });
      expect(redirect).toBe(expected);
      expect(readRuntimeQueryMock).not.toHaveBeenCalled();
    })
  );

  it.effect("redirects HEAD requests for an exposed article category", () =>
    Effect.gen(function* () {
      articleMocks.hasCategory
        .mockReturnValueOnce(Effect.succeed(false))
        .mockReturnValueOnce(Effect.succeed(true));

      const redirect = yield* readPublicUrlMigrationRedirect({
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
        articleMocks.readActiveIdentity.mockReturnValueOnce(
          Effect.succeed(null)
        );

        const redirect = yield* readPublicUrlMigrationRedirect({
          method: "GET",
          pathname: "/de/articles/politics/regional-elections-turmoil",
        });
        expect(redirect).toBeNull();
        expect(articleMocks.readActiveRoute).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    { activeReleaseId: "release-test", managed: true, publicPath: null },
    { activeReleaseId: null, managed: false, publicPath: null },
    {
      activeReleaseId: null,
      managed: true,
      publicPath: "subjects/mathematics/circle/section",
    },
  ])("does not redirect an absent signed identity", (decision) =>
    Effect.gen(function* () {
      readRuntimeQueryMock.mockReturnValueOnce(Effect.succeed(decision));

      const redirect = yield* readPublicUrlMigrationRedirect({
        method: "HEAD",
        pathname:
          "/en/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
      });
      expect(redirect).toBeNull();
    })
  );

  it.effect.each([
    {
      method: "POST",
      pathname:
        "/en/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
    },
    {
      method: "POST",
      pathname: "/de/articles/politics",
    },
    {
      method: "GET",
      pathname:
        "/fr/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
    },
    {
      method: "GET",
      pathname:
        "/de/subject/high-school/11/mathematics/statistics/scatter-diagram",
    },
    {
      method: "GET",
      pathname:
        "/en/subject/high-school/9/mathematics/statistics/scatter-diagram",
    },
    {
      method: "GET",
      pathname: "/en/subject/high-school/11/mathematics/circle",
    },
    {
      method: "GET",
      pathname:
        "/en/subject/high-school/11/mathematics/circle/central-angle/extra",
    },
    {
      method: "GET",
      pathname: "/en/subject/high-school/11/mathematics/circle/NotAContentKey",
    },
  ])("ignores a non-migration request", (request) =>
    Effect.gen(function* () {
      const redirect = yield* readPublicUrlMigrationRedirect(request);

      expect(redirect).toBeNull();
      expect(readRuntimeQueryMock).not.toHaveBeenCalled();
      expect(articleMocks.hasCategory).not.toHaveBeenCalled();
      expect(articleMocks.readActiveIdentity).not.toHaveBeenCalled();
    })
  );
});
