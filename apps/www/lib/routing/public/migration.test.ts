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
      contentKey:
        "material/lesson/mathematics/circle/central-angle-and-inscribed-angle",
      expectedMaterialKey: "lesson.mathematics.circle",
      expectedSectionKey: "central-angle-and-inscribed-angle",
      locale: "id",
    });
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
