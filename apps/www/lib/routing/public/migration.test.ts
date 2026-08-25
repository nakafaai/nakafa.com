// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";

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

  it("redirects a retired URL to its authenticated current route", async () => {
    readRuntimeQueryMock.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId: "release-test",
        managed: true,
        publicPath:
          "materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling",
      })
    );

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "GET",
          pathname:
            "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
        })
      )
    ).resolves.toBe(
      "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling"
    );
    expect(readRuntimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "id",
      contentKey:
        "material/lesson/mathematics/circle/central-angle-and-inscribed-angle",
      expectedMaterialKey: "lesson.mathematics.circle",
      expectedSectionKey: "central-angle-and-inscribed-angle",
    });
  });

  it.each([
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
    async ({ expectedIdentity, pathname, publicPath }) => {
      readRuntimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-test",
          managed: true,
          publicPath,
        })
      );

      await expect(
        Effect.runPromise(
          readPublicUrlMigrationRedirect({ method: "GET", pathname })
        )
      ).resolves.toBe(`/${expectedIdentity.appLocale}/${publicPath}`);
      expect(readRuntimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        expectedIdentity
      );
    }
  );

  it.each([
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
  ])("redirects exposed German article URL %s", async (pathname, expected) => {
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

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({ method: "GET", pathname })
      )
    ).resolves.toBe(expected);
    expect(readRuntimeQueryMock).not.toHaveBeenCalled();
  });

  it("redirects HEAD requests for an exposed article category", async () => {
    articleMocks.hasCategory
      .mockReturnValueOnce(Effect.succeed(false))
      .mockReturnValueOnce(Effect.succeed(true));

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "HEAD",
          pathname: "/de/articles/politics",
        })
      )
    ).resolves.toBe("/de/articles/politik");
  });

  it("keeps article routes owned by a recovered signed release", async () => {
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

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "GET",
          pathname: "/de/articles/politics/regional-elections-turmoil",
        })
      )
    ).resolves.toBeNull();
  });

  it("keeps category routes owned by a recovered signed release", async () => {
    articleMocks.hasCategory
      .mockReturnValueOnce(Effect.succeed(true))
      .mockReturnValueOnce(Effect.succeed(false));

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "HEAD",
          pathname: "/de/articles/politics",
        })
      )
    ).resolves.toBeNull();
  });

  it("does not redirect an article without active signed ownership", async () => {
    articleMocks.readActiveIdentity.mockReturnValueOnce(Effect.succeed(null));

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "GET",
          pathname: "/de/articles/politics/regional-elections-turmoil",
        })
      )
    ).resolves.toBeNull();
    expect(articleMocks.readActiveRoute).not.toHaveBeenCalled();
  });

  it.each([
    { activeReleaseId: "release-test", managed: true, publicPath: null },
    { activeReleaseId: null, managed: false, publicPath: null },
    {
      activeReleaseId: null,
      managed: true,
      publicPath: "subjects/mathematics/circle/section",
    },
  ])("does not redirect an absent signed identity", async (decision) => {
    readRuntimeQueryMock.mockReturnValueOnce(Effect.succeed(decision));

    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "HEAD",
          pathname:
            "/en/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
        })
      )
    ).resolves.toBeNull();
  });

  it.each([
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
  ])("ignores a non-migration request", async (request) => {
    await expect(
      Effect.runPromise(readPublicUrlMigrationRedirect(request))
    ).resolves.toBeNull();
    expect(readRuntimeQueryMock).not.toHaveBeenCalled();
    expect(articleMocks.hasCategory).not.toHaveBeenCalled();
    expect(articleMocks.readActiveIdentity).not.toHaveBeenCalled();
  });
});
