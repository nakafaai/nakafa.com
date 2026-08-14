import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLocalizedNavigationHref } from "@/lib/routing/locale/resolve";
import { previewIdProjection, previewProjection } from "@/test/content-preview";
import {
  readTestPublishedRoute,
  testProgramSubject,
} from "@/test/content-program";

const publishedMocks = vi.hoisted(() => ({
  materialContext: vi.fn(),
  materialRoute: vi.fn(),
  programRoute: vi.fn(),
  tryoutPath: vi.fn(),
}));
const activeReleaseId = ReleaseIdSchema.make("release-material");
const activeMaterialRoute = {
  activeReleaseId,
  alternates: [previewProjection, previewIdProjection],
  projection: previewProjection,
};
const idProgramSubject = readTestPublishedRoute(
  "kurikulum/merdeka/kelas-11/matematika",
  "id"
);

vi.mock("@/lib/content/material/context", () => ({
  readPublishedMaterialContext: publishedMocks.materialContext,
}));
vi.mock("@/lib/content/material/route", () => ({
  readPublishedMaterialRoute: publishedMocks.materialRoute,
}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: publishedMocks.programRoute,
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: publishedMocks.tryoutPath,
}));
/** Resolves a localized href through the Effect boundary used by callers. */
function resolveHref(href: string, locale: "en" | "id") {
  return Effect.runSync(resolveLocalizedNavigationHref({ href, locale }));
}

beforeEach(() => {
  publishedMocks.materialContext
    .mockReset()
    .mockReturnValue(Effect.succeed(null));
  publishedMocks.materialRoute
    .mockReset()
    .mockReturnValue(Effect.succeed(activeMaterialRoute));
  publishedMocks.programRoute
    .mockReset()
    .mockReturnValue(Effect.succeed({ alternates: [], route: null }));
  publishedMocks.tryoutPath.mockReset().mockImplementation(({ publicPath }) => {
    const counterparts = new Map([
      ["try-out/indonesia", "try-out/indonesia"],
      [
        "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
      ],
    ]);
    return Effect.succeed(counterparts.get(publicPath) ?? null);
  });
});

describe("resolveLocalizedNavigationHref", () => {
  it("projects signed material and curriculum counterparts", () => {
    expect(
      resolveHref(
        `/${previewProjection.appLocale}/${previewProjection.publicPath}`,
        "id"
      )
    ).toBe(`/${previewIdProjection.publicPath}`);

    publishedMocks.programRoute.mockReturnValue(
      Effect.succeed({
        alternates: [testProgramSubject, idProgramSubject],
        route: testProgramSubject,
      })
    );
    expect(
      resolveHref(
        `/${testProgramSubject.appLocale}/${testProgramSubject.publicPath}`,
        "id"
      )
    ).toBe(`/${idProgramSubject.publicPath}`);
  });

  it("keeps material context only while the signed program verifies it", () => {
    const href = `/${previewProjection.appLocale}/${previewProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`;
    publishedMocks.materialContext
      .mockReturnValueOnce(Effect.succeed({ context: {} }))
      .mockReturnValueOnce(Effect.succeed(null));

    expect(resolveHref(href, "id")).toBe(
      `/${previewIdProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`
    );
    expect(resolveHref(href, "id")).toBe(`/${previewIdProjection.publicPath}`);
  });

  it("preserves verified context across signed material route renames", () => {
    const currentPath = PublicPathSchema.make(
      "subjects/mathematics/function-composition-inverse-function/renamed-function"
    );
    const targetPath = PublicPathSchema.make(
      "materi/matematika/fungsi-komposisi-dan-fungsi-invers/fungsi-berganti"
    );
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        alternates: [
          { ...previewProjection, publicPath: currentPath },
          { ...previewIdProjection, publicPath: targetPath },
        ],
        projection: { ...previewProjection, publicPath: currentPath },
      })
    );
    publishedMocks.materialContext.mockReturnValue(
      Effect.succeed({ context: {} })
    );

    expect(
      resolveHref(
        `/en/${currentPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`,
        "id"
      )
    ).toBe(
      `/${targetPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`
    );
  });

  it("fails closed for signed tombstones and missing locale rows", () => {
    publishedMocks.materialRoute
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          alternates: [],
          projection: null,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          alternates: [previewProjection],
          projection: previewProjection,
        })
      );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: `/${previewProjection.appLocale}/${previewProjection.publicPath}`,
          locale: "id",
        })
      );
      expect(result._tag).toBe("Failure");
    }

    publishedMocks.programRoute
      .mockReturnValueOnce(Effect.succeed({ alternates: [], route: null }))
      .mockReturnValueOnce(
        Effect.succeed({ alternates: [], route: testProgramSubject })
      );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: `/${testProgramSubject.appLocale}/${testProgramSubject.publicPath}`,
          locale: "id",
        })
      );
      expect(result._tag).toBe("Failure");
    }
  });

  it("projects mapped curriculum and tryout paths", () => {
    expect(resolveHref("/id/kurikulum", "en")).toBe("/curriculum");
    expect(resolveHref("/en/curriculum", "id")).toBe("/kurikulum");
    expect(resolveHref("/id/try-out/indonesia", "en")).toBe(
      "/try-out/indonesia"
    );
    expect(
      resolveHref(
        "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
        "en"
      )
    ).toBe("/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge");
  });

  it("keeps static app routes and safe URL state", () => {
    expect(resolveHref("/id/search?q=vektor#results", "en")).toBe(
      "/search?q=vektor#results"
    );
    expect(resolveHref("/en/home", "id")).toBe("/home");
    expect(resolveHref("/search?q=vektor", "en")).toBe("/search?q=vektor");
    expect(resolveHref("/id/search", "id")).toBe("/search");
    expect(resolveHref("/id", "en")).toBe("/");
    expect(resolveHref("/en", "id")).toBe("/");
    expect(
      resolveHref("/id/internal-preview/alpha?source=meeting#top", "en")
    ).toBe("/internal-preview/alpha?source=meeting#top");
  });

  it("fails malformed and missing projected routes", () => {
    expect(
      Effect.runSyncExit(
        resolveLocalizedNavigationHref({ href: "http://[", locale: "en" })
      )._tag
    ).toBe("Failure");

    publishedMocks.materialRoute.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId,
        alternates: [],
        projection: null,
      })
    );
    expect(
      Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: "/id/materi/fisika/tidak-ada",
          locale: "en",
        })
      )._tag
    ).toBe("Failure");

    expect(
      Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: "/id/try-out/tidak-ada",
          locale: "en",
        })
      )._tag
    ).toBe("Failure");

    expect(
      Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: "/id/try-out/indonesia/untranslated",
          locale: "en",
        })
      )._tag
    ).toBe("Failure");
  });
});
