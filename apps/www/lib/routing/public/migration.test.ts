// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";

const readRuntimeQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readRuntimeQueryMock,
}));

describe("public URL migration redirects", () => {
  beforeEach(() => {
    readRuntimeQueryMock.mockReset();
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
    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({ method: "GET", pathname })
      )
    ).resolves.toBe(expected);
    expect(readRuntimeQueryMock).not.toHaveBeenCalled();
  });

  it("redirects HEAD requests for an exposed article category", async () => {
    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "HEAD",
          pathname: "/de/articles/politics",
        })
      )
    ).resolves.toBe("/de/articles/politik");
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
  });
});
