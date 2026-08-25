import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedLocalizedHref } from "@/lib/routing/locale/published";
import {
  testArticleDeProjection,
  testArticleIdProjection,
  testArticleProjection,
} from "@/test/content-article";
import { previewIdProjection, previewProjection } from "@/test/content-preview";
import {
  readTestPublishedRoute,
  testProgramSubject,
} from "@/test/content-program";

const publishedMocks = vi.hoisted(() => ({
  articleCategory: vi.fn(),
  articleRoute: vi.fn(),
  categoryAlternates: vi.fn(),
  materialContext: vi.fn(),
  materialRoute: vi.fn(),
  pagePath: vi.fn(),
  programRoute: vi.fn(),
  tryoutPath: vi.fn(),
}));
const activeReleaseId = ReleaseIdSchema.make("material-release");
const articleProjections = [
  testArticleProjection,
  testArticleIdProjection,
  testArticleDeProjection,
];
const articleLocalePairs = articleProjections.flatMap((current) =>
  articleProjections
    .filter((target) => target.appLocale !== current.appLocale)
    .map((target) => ({ current, target }))
);
const idProgramSubject = readTestPublishedRoute(
  "kurikulum/merdeka/kelas-11/matematika",
  "id"
);
const deProgramSubject = readTestPublishedRoute(
  "lehrplaene/merdeka/klasse-11/mathematik",
  "de"
);

vi.mock("@/lib/content/article/category", () => ({
  readPublishedArticleCategory: publishedMocks.articleCategory,
  readPublishedCategoryAlternates: publishedMocks.categoryAlternates,
}));
vi.mock("@/lib/content/article/route", () => ({
  readPublishedArticleRoute: publishedMocks.articleRoute,
}));
vi.mock("@/lib/content/material/context", () => ({
  readPublishedMaterialContext: publishedMocks.materialContext,
}));
vi.mock("@/lib/content/material/route", () => ({
  readPublishedMaterialRoute: publishedMocks.materialRoute,
}));
vi.mock("@/lib/content/page/catalog", () => ({
  readPublishedPageLocalePath: publishedMocks.pagePath,
}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: publishedMocks.programRoute,
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: publishedMocks.tryoutPath,
}));

beforeEach(() => {
  publishedMocks.articleCategory
    .mockReset()
    .mockImplementation((route: string, locale: string) => {
      const projection = articleProjections.find(
        (article) =>
          article.appLocale === locale && article.categoryRouteSlug === route
      );
      return Effect.succeed(
        projection
          ? Option.some({ category: projection.category })
          : Option.none()
      );
    });
  publishedMocks.articleRoute
    .mockReset()
    .mockImplementation((locale: string, publicPath: string) => {
      const projection = articleProjections.find(
        (article) =>
          article.appLocale === locale && article.publicPath === publicPath
      );
      return Effect.succeed(
        projection
          ? {
              activeReleaseId,
              alternates: articleProjections,
              projection,
            }
          : { activeReleaseId, alternates: [], projection: null }
      );
    });
  publishedMocks.categoryAlternates.mockReset().mockReturnValue(
    Effect.succeed(
      articleProjections.map((article) => ({
        appLocale: article.appLocale,
        publicPath: article.parentPath,
      }))
    )
  );
  publishedMocks.materialContext.mockReset();
  publishedMocks.materialRoute.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId,
      alternates: [previewProjection, previewIdProjection],
      projection: previewProjection,
    })
  );
  publishedMocks.pagePath
    .mockReset()
    .mockReturnValue(Effect.succeed({ kind: "unmanaged" }));
  publishedMocks.programRoute.mockReset().mockReturnValue(
    Effect.succeed({
      alternates: [testProgramSubject, idProgramSubject, deProgramSubject],
      route: testProgramSubject,
    })
  );
  publishedMocks.tryoutPath.mockReset().mockReturnValue(Effect.succeed(null));
});

/** Reads one English material route through its Indonesian signed target. */
function readMaterialHref(search = "") {
  return Effect.runSync(
    readPublishedLocalizedHref({
      currentLocale: "en",
      hash: "",
      locale: "id",
      publicPath: previewProjection.publicPath,
      search,
    })
  );
}

describe("published localized route ownership", () => {
  it.each(articleLocalePairs)(
    "projects $current.appLocale article categories to $target.appLocale",
    ({ current, target }) => {
      expect(
        Effect.runSync(
          readPublishedLocalizedHref({
            currentLocale: current.appLocale,
            hash: "#latest",
            locale: target.appLocale,
            publicPath: current.parentPath,
            search:
              "?cursor=source&manifest=source&release=source&source=locale",
          })
        )
      ).toBe(`/${target.parentPath}?source=locale#latest`);
    }
  );

  it.each(articleLocalePairs)(
    "projects $current.appLocale article details to $target.appLocale",
    ({ current, target }) => {
      expect(
        Effect.runSync(
          readPublishedLocalizedHref({
            currentLocale: current.appLocale,
            hash: "#references",
            locale: target.appLocale,
            publicPath: current.publicPath,
            search: "?source=locale",
          })
        )
      ).toBe(`/${target.publicPath}?source=locale#references`);
    }
  );

  it("fails closed for missing or malformed article projections", () => {
    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: "articles",
          search: "",
        })
      )
    ).toBeNull();

    publishedMocks.articleCategory.mockReturnValueOnce(
      Effect.succeed(Option.none())
    );
    expect(() =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: "articles/missing",
          search: "",
        })
      )
    ).toThrow();

    publishedMocks.categoryAlternates.mockReturnValueOnce(
      Effect.succeed([
        {
          appLocale: testArticleProjection.appLocale,
          publicPath: testArticleProjection.parentPath,
        },
      ])
    );
    expect(() =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: testArticleProjection.parentPath,
          search: "",
        })
      )
    ).toThrow();

    publishedMocks.articleRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId, alternates: [], projection: null })
    );
    expect(() =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: testArticleProjection.publicPath,
          search: "",
        })
      )
    ).toThrow();

    publishedMocks.articleRoute.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId,
        alternates: [testArticleProjection],
        projection: testArticleProjection,
      })
    );
    expect(() =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: testArticleProjection.publicPath,
          search: "",
        })
      )
    ).toThrow();

    expect(() =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: "articles/politics/article/extra",
          search: "",
        })
      )
    ).toThrow();
  });

  it("projects a material route through signed locale counterparts", () => {
    expect(readMaterialHref()).toBe(`/${previewIdProjection.publicPath}`);
    expect(publishedMocks.materialRoute).toHaveBeenCalledWith(
      "en",
      previewProjection.publicPath
    );
  });

  it("keeps only backend-verified material context", () => {
    const search =
      "?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
    publishedMocks.materialContext
      .mockReturnValueOnce(Effect.succeed({ context: {} }))
      .mockReturnValueOnce(Effect.succeed(null));

    expect(readMaterialHref(search)).toBe(
      `/${previewIdProjection.publicPath}${search}`
    );
    expect(readMaterialHref(search)).toBe(`/${previewIdProjection.publicPath}`);
  });

  it("fails closed for material tombstones and missing counterparts", () => {
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

    expect(() => readMaterialHref()).toThrow();
    expect(() => readMaterialHref()).toThrow();
  });

  it("projects signed curriculum counterparts and ignores static surfaces", () => {
    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: testProgramSubject.publicPath,
          search: "",
        })
      )
    ).toBe(`/${idProgramSubject.publicPath}`);
    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: testProgramSubject.publicPath,
          search: "",
        })
      )
    ).toBe(`/${deProgramSubject.publicPath}`);
    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: "search",
          search: "",
        })
      )
    ).toBeNull();
  });

  it("projects signed try-out counterparts and fails closed for tombstones", () => {
    publishedMocks.tryoutPath
      .mockReturnValueOnce(
        Effect.succeed(
          "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
        )
      )
      .mockReturnValueOnce(Effect.succeed(null));
    const read = () =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "id",
          hash: "",
          locale: "en",
          publicPath:
            "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
          search: "",
        })
      );

    expect(read()).toBe(
      "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
    );
    expect(read).toThrow();
  });

  it("fails closed for curriculum tombstones and missing counterparts", () => {
    publishedMocks.programRoute
      .mockReturnValueOnce(Effect.succeed({ alternates: [], route: null }))
      .mockReturnValueOnce(
        Effect.succeed({
          alternates: [testProgramSubject],
          route: testProgramSubject,
        })
      );
    const read = () =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: testProgramSubject.publicPath,
          search: "",
        })
      );

    expect(read).toThrow();
    expect(read).toThrow();
  });

  it("projects signed Page counterparts and preserves safe URL state", () => {
    publishedMocks.pagePath.mockReturnValueOnce(
      Effect.succeed({ kind: "found", publicPath: "impressum" })
    );

    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "#company",
          locale: "de",
          publicPath: "legal-notice",
          search: "?source=footer",
        })
      )
    ).toBe("/impressum?source=footer#company");
    expect(publishedMocks.pagePath).toHaveBeenCalledWith({
      currentLocale: "en",
      locale: "de",
      publicPath: "legal-notice",
    });

    publishedMocks.pagePath.mockReturnValueOnce(
      Effect.succeed({ kind: "missing" })
    );
    expect(() =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: "legal-notice",
          search: "",
        })
      )
    ).toThrow();
  });
});
