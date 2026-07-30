import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import type { PublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import * as publicLearningStatic from "@repo/contents/_types/route/learning/static";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLocalizedNavigationHref } from "@/lib/routing/locale/resolve";
import {
  previewIdProjection,
  previewProjection,
  previewPublicRoute,
} from "@/test/content-preview";
import {
  readTestPublishedRoute,
  testProgramSubject,
} from "@/test/content-program";

const publishedMocks = vi.hoisted(() => ({
  materialContext: vi.fn(),
  materialRoute: vi.fn(),
  materialSource: vi.fn(),
  programRoute: vi.fn(),
}));
const activeMaterialRoute = {
  alternates: [previewProjection, previewIdProjection],
  familyManaged: true,
  managed: true,
  projection: previewProjection,
  sourceClaims: [],
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
vi.mock("@/lib/content/material/shell", () => ({
  readMaterialSource: publishedMocks.materialSource,
}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: publishedMocks.programRoute,
}));

const emptyLearningIndex: PublicLearningIndex = {
  projectMaterialContextToLocale: () => undefined,
  projectRouteToLocale: () => undefined,
  resolveMaterialHeaderLink: () => undefined,
  resolveMaterialRouteBySource: () => undefined,
  resolveRouteByPath: () => undefined,
  toContextualMaterialHref: ({ href }) => href,
};

/** Resolves a localized href through the Effect boundary used by route callers. */
function resolveHref(href: string, locale: "en" | "id") {
  return Effect.runSync(resolveLocalizedNavigationHref({ href, locale }));
}

beforeEach(() => {
  publishedMocks.materialContext.mockReset();
  publishedMocks.materialRoute.mockReset();
  publishedMocks.programRoute.mockReset();
  publishedMocks.materialRoute.mockReturnValue(
    Effect.succeed({
      managed: false,
      projection: null,
      sourceClaims: [],
    })
  );
  publishedMocks.materialSource.mockReturnValue({
    candidates: [
      {
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
      },
      {
        contentKey: previewIdProjection.contentKey,
        locale: previewIdProjection.locale,
      },
    ],
    route: previewPublicRoute,
  });
  publishedMocks.programRoute.mockReturnValue(
    Effect.succeed({ managed: false, route: null })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLocalizedNavigationHref", () => {
  it("projects material lessons by source identity instead of preserving localized slugs", () => {
    expect(
      resolveHref(
        "/id/materi/ai-ds/metode-linear-ai/sistem-persamaan-linear",
        "en"
      )
    ).toBe("/subjects/ai-ds/linear-methods/system-linear-equation");

    expect(
      resolveHref(
        "/en/subjects/ai-ds/linear-methods/system-linear-equation",
        "id"
      )
    ).toBe("/materi/ai-ds/metode-linear-ai/sistem-persamaan-linear");
  });

  it("projects valid material context hints and drops stale ones", () => {
    expect(
      resolveHref(
        "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear?ctx=merdeka~class-10-mathematics-linear-equation-inequality",
        "en"
      )
    ).toBe(
      "/subjects/mathematics/linear-equation-inequality/system-linear-equation?ctx=merdeka~class-10-mathematics-linear-equation-inequality"
    );

    expect(
      resolveHref(
        "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear?ctx=merdeka~class-10-biology-virus-role",
        "en"
      )
    ).toBe(
      "/subjects/mathematics/linear-equation-inequality/system-linear-equation"
    );
  });

  it("projects other concrete material lessons to the target namespace and slugs", () => {
    expect(resolveHref("/id/materi/fisika/vektor/konsep-vektor", "en")).toBe(
      "/subjects/physics/vector/concept"
    );

    expect(resolveHref("/en/subjects/physics/vector/concept", "id")).toBe(
      "/materi/fisika/vektor/konsep-vektor"
    );
  });

  it("projects curriculum pages by program and node identity", () => {
    expect(resolveHref("/id/kurikulum/merdeka/kelas-10/biologi", "en")).toBe(
      "/curriculum/merdeka/class-10/biology"
    );

    expect(resolveHref("/en/curriculum/merdeka/class-10/biology", "id")).toBe(
      "/kurikulum/merdeka/kelas-10/biologi"
    );
  });

  it("projects active material and curriculum owners without static rows", () => {
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed(activeMaterialRoute)
    );
    expect(
      resolveHref(
        `/${previewProjection.locale}/${previewProjection.publicPath}`,
        "id"
      )
    ).toBe(`/${previewIdProjection.publicPath}`);

    publishedMocks.programRoute.mockReturnValue(
      Effect.succeed({
        alternates: [
          {
            ...idProgramSubject,
            level: "unit",
            publicPath: `${idProgramSubject.publicPath}/internal`,
            sitemap: false,
          },
          testProgramSubject,
          idProgramSubject,
        ],
        managed: true,
        route: testProgramSubject,
      })
    );
    expect(
      resolveHref(
        `/${testProgramSubject.locale}/${testProgramSubject.publicPath}`,
        "id"
      )
    ).toBe(`/${idProgramSubject.publicPath}`);
  });

  it("fails closed for active material tombstones and missing locale rows", () => {
    publishedMocks.materialRoute
      .mockReturnValueOnce(Effect.succeed({ managed: true, projection: null }))
      .mockReturnValueOnce(
        Effect.succeed({
          alternates: [previewProjection],
          familyManaged: true,
          managed: true,
          projection: previewProjection,
          sourceClaims: [],
        })
      );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: `/${previewProjection.locale}/${previewProjection.publicPath}`,
          locale: "id",
        })
      );
      expect(result._tag).toBe("Failure");
    }
  });

  it("reconciles source and partial exact material target states", () => {
    const href = `/${previewProjection.locale}/${previewProjection.publicPath}`;
    publishedMocks.materialSource.mockReturnValueOnce({
      candidates: [],
      route: undefined,
    });
    expect(resolveHref(href, "id")).toBe(`/${previewIdProjection.publicPath}`);

    const renamedId = {
      ...previewIdProjection,
      publicPath: `${previewIdProjection.parentPath}/fungsi-berganti`,
    };
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed({
        managed: false,
        projection: null,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "found",
            locale: "id",
            projection: renamedId,
          },
        ],
      })
    );
    expect(resolveHref(href, "id")).toBe(`/${renamedId.publicPath}`);
    expect(publishedMocks.materialRoute).toHaveBeenCalledWith(
      previewProjection.locale,
      previewProjection.publicPath,
      expect.arrayContaining([
        {
          contentKey: previewProjection.contentKey,
          locale: previewIdProjection.locale,
        },
      ])
    );
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed({
        managed: false,
        projection: null,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "missing",
            locale: "id",
          },
        ],
      })
    );
    expect(() => resolveHref(href, "id")).toThrow();

    const partial = {
      activeReleaseId: "material-partial",
      alternates: [previewProjection],
      familyManaged: false,
      managed: true,
      projection: previewProjection,
      sourceClaims: [],
    };
    const found = {
      ...previewIdProjection,
      publicPath: `${previewIdProjection.parentPath}/renamed-function`,
    };
    /** Runs one authoritative refresh after the initial partial model. */
    const read = (refresh: object) => {
      publishedMocks.materialRoute
        .mockReturnValueOnce(Effect.succeed(partial))
        .mockReturnValueOnce(Effect.succeed(refresh));
      return resolveHref(href, "id");
    };

    expect(read(partial)).toBe(`/${previewIdProjection.publicPath}`);
    const context =
      "?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
    publishedMocks.materialRoute
      .mockReturnValueOnce(Effect.succeed(partial))
      .mockReturnValueOnce(Effect.succeed(partial));
    publishedMocks.materialContext.mockReturnValueOnce(
      Effect.succeed({ managed: false, value: null })
    );
    expect(resolveHref(`${href}${context}`, "id")).toBe(
      `/${previewIdProjection.publicPath}${context}`
    );
    expect(
      read({ ...partial, alternates: [previewProjection, previewIdProjection] })
    ).toBe(`/${previewIdProjection.publicPath}`);
    expect(
      read({
        ...partial,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "found",
            locale: previewIdProjection.locale,
            projection: found,
          },
        ],
      })
    ).toBe(`/${found.publicPath}`);
    expect(() =>
      read({
        ...partial,
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "missing",
            locale: previewIdProjection.locale,
          },
        ],
      })
    ).toThrow();
    expect(() =>
      read({ managed: false, projection: null, sourceClaims: [] })
    ).toThrow();
    expect(() =>
      read({ ...partial, activeReleaseId: "material-replaced" })
    ).toThrow();

    publishedMocks.materialRoute.mockReturnValue(Effect.succeed(partial));
    vi.spyOn(
      publicLearningStatic,
      "loadStaticPublicLearningIndex"
    ).mockReturnValueOnce(Effect.succeed(emptyLearningIndex));
    expect(() => resolveHref(href, "id")).toThrow();
  });

  it("keeps material context only while the active program verifies it", () => {
    const href = `/${previewProjection.locale}/${previewProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`;
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed(activeMaterialRoute)
    );
    publishedMocks.materialContext
      .mockReturnValueOnce(
        Effect.succeed({
          managed: true,
          value: {
            context: {
              nodeKey:
                "class-11-mathematics-function-composition-inverse-function",
              programKey: "merdeka",
            },
          },
        })
      )
      .mockReturnValueOnce(Effect.succeed({ managed: true, value: null }));

    expect(resolveHref(href, "id")).toBe(
      `/${previewIdProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`
    );
    expect(resolveHref(href, "id")).toBe(`/${previewIdProjection.publicPath}`);
  });

  it("uses source context only while the active program is unmanaged", () => {
    const href = `/${previewProjection.locale}/${previewProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`;
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed(activeMaterialRoute)
    );
    publishedMocks.materialContext.mockReturnValue(
      Effect.succeed({ managed: false, value: null })
    );

    expect(resolveHref(href, "id")).toContain("?ctx=merdeka~");

    const missingTargetIndex: PublicLearningIndex = {
      ...emptyLearningIndex,
      resolveMaterialRouteBySource: (_sourcePath, locale) =>
        locale === previewProjection.locale ? previewPublicRoute : undefined,
    };
    vi.spyOn(publicLearningStatic, "loadStaticPublicLearningIndex")
      .mockImplementationOnce(() => Effect.succeed(emptyLearningIndex))
      .mockImplementationOnce(() => Effect.succeed(missingTargetIndex));

    expect(resolveHref(href, "id")).toBe(`/${previewIdProjection.publicPath}`);
    expect(resolveHref(href, "id")).toBe(`/${previewIdProjection.publicPath}`);
  });

  it("preserves source context across published material route renames", () => {
    const currentPath =
      "subjects/mathematics/function-composition-inverse-function/renamed-function";
    const targetPath =
      "materi/matematika/fungsi-komposisi-dan-fungsi-invers/fungsi-berganti";
    publishedMocks.materialRoute.mockReturnValue(
      Effect.succeed({
        alternates: [
          { ...previewProjection, publicPath: currentPath },
          { ...previewIdProjection, publicPath: targetPath },
        ],
        managed: true,
        projection: { ...previewProjection, publicPath: currentPath },
      })
    );
    publishedMocks.materialContext.mockReturnValue(
      Effect.succeed({ managed: false, value: null })
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

  it("fails closed for active curriculum tombstones and missing locale rows", () => {
    publishedMocks.programRoute
      .mockReturnValueOnce(Effect.succeed({ managed: true, route: null }))
      .mockReturnValueOnce(
        Effect.succeed({
          alternates: [],
          managed: true,
          route: testProgramSubject,
        })
      );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = Effect.runSyncExit(
        resolveLocalizedNavigationHref({
          href: `/${testProgramSubject.locale}/${testProgramSubject.publicPath}`,
          locale: "id",
        })
      );
      expect(result._tag).toBe("Failure");
    }
  });

  it("projects mapped static curriculum index pathnames without learning-index rows", () => {
    expect(resolveHref("/id/kurikulum", "en")).toBe("/curriculum");
    expect(resolveHref("/en/curriculum", "id")).toBe("/kurikulum");
    expect(resolveHref("/id/kurikulum?source=sidebar#subjects", "en")).toBe(
      "/curriculum?source=sidebar#subjects"
    );
  });

  it("keeps canonical try-out discovery paths stable across locale switching", () => {
    expect(resolveHref("/id/try-out/indonesia", "en")).toBe(
      "/try-out/indonesia"
    );
    expect(resolveHref("/en/try-out/indonesia", "id")).toBe(
      "/try-out/indonesia"
    );

    expect(resolveHref("/id/try-out/indonesia/snbt", "en")).toBe(
      "/try-out/indonesia/snbt"
    );

    expect(resolveHref("/en/try-out/indonesia/snbt", "id")).toBe(
      "/try-out/indonesia/snbt"
    );
  });

  it("keeps concrete try-out set and section URLs canonical across locale switching", () => {
    expect(resolveHref("/id/try-out/indonesia/snbt/2027/set-1", "en")).toBe(
      "/try-out/indonesia/snbt/2027/set-1"
    );

    expect(
      resolveHref(
        "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
        "en"
      )
    ).toBe("/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge");

    expect(
      resolveHref(
        "/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
        "id"
      )
    ).toBe("/try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif");
  });

  it("keeps static app pages on normal localized path switching with safe state", () => {
    expect(resolveHref("/id/search?q=vektor#results", "en")).toBe(
      "/search?q=vektor#results"
    );

    expect(resolveHref("/en/home", "id")).toBe("/home");
    expect(resolveHref("/search?q=vektor", "en")).toBe("/search?q=vektor");
    expect(resolveHref("/id/search", "id")).toBe("/search");
    expect(resolveHref("/id", "en")).toBe("/");
    expect(resolveHref("/en", "id")).toBe("/");
  });

  it("fails expected projected-route misses instead of generating mixed-locale URLs", () => {
    const result = Effect.runSyncExit(
      resolveLocalizedNavigationHref({
        href: "/id/materi/fisika/tidak-ada",
        locale: "en",
      })
    );

    expect(result._tag).toBe("Failure");
  });

  it("keeps unknown non-projected app paths on normal localized path switching", () => {
    expect(
      resolveHref("/id/internal-preview/alpha?source=meeting#top", "en")
    ).toBe("/internal-preview/alpha?source=meeting#top");
  });

  it("fails malformed hrefs with a typed route-localization failure", () => {
    const result = Effect.runSyncExit(
      resolveLocalizedNavigationHref({
        href: "http://[",
        locale: "en",
      })
    );

    expect(result._tag).toBe("Failure");
  });

  it("fails projected routes when the target locale projection is missing", () => {
    const idOnlyRoute = readStaticPublicContentRoutes().find(
      (route) => route.publicPath === "materi/fisika/vektor/konsep-vektor"
    );

    expect(idOnlyRoute).toBeDefined();

    if (!idOnlyRoute) {
      throw new Error("Expected ID vector lesson route fixture");
    }

    const index: PublicLearningIndex = {
      ...emptyLearningIndex,
      resolveRouteByPath: () => idOnlyRoute,
    };

    vi.spyOn(
      publicLearningStatic,
      "loadStaticPublicLearningIndex"
    ).mockImplementation(() => Effect.succeed(index));

    const result = Effect.runSyncExit(
      resolveLocalizedNavigationHref({
        href: "/id/materi/fisika/vektor/konsep-vektor",
        locale: "en",
      })
    );

    expect(result._tag).toBe("Failure");
  });
});
