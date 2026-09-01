import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option } from "effect";
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
  return readPublishedLocalizedHref({
    currentLocale: "en",
    hash: "",
    locale: "id",
    publicPath: previewProjection.publicPath,
    search,
  });
}

describe("published localized route ownership", () => {
  it.effect.each(articleLocalePairs)(
    "projects $current.appLocale article categories to $target.appLocale",
    ({ current, target }) =>
      Effect.gen(function* () {
        const href = yield* readPublishedLocalizedHref({
          currentLocale: current.appLocale,
          hash: "#latest",
          locale: target.appLocale,
          publicPath: current.parentPath,
          search: "?cursor=source&manifest=source&release=source&source=locale",
        });

        expect(href).toBe(`/${target.parentPath}?source=locale#latest`);
      })
  );

  it.effect.each(articleLocalePairs)(
    "projects $current.appLocale article details to $target.appLocale",
    ({ current, target }) =>
      Effect.gen(function* () {
        const href = yield* readPublishedLocalizedHref({
          currentLocale: current.appLocale,
          hash: "#references",
          locale: target.appLocale,
          publicPath: current.publicPath,
          search: "?source=locale",
        });

        expect(href).toBe(`/${target.publicPath}?source=locale#references`);
      })
  );

  it.effect("fails closed for missing or malformed article projections", () =>
    Effect.gen(function* () {
      const read = (publicPath: string, locale: "de" | "id" = "id") =>
        readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale,
          publicPath,
          search: "",
        });

      const unmanaged = yield* read("articles");
      expect(unmanaged).toBeNull();

      publishedMocks.articleCategory.mockReturnValueOnce(
        Effect.succeed(Option.none())
      );
      const missingCategory = yield* read("articles/missing").pipe(Effect.flip);
      expect(missingCategory).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
        locale: "id",
        publicPath: "articles/missing",
      });

      publishedMocks.categoryAlternates.mockReturnValueOnce(
        Effect.succeed([
          {
            appLocale: testArticleProjection.appLocale,
            publicPath: testArticleProjection.parentPath,
          },
        ])
      );
      const missingCategoryAlternate = yield* read(
        testArticleProjection.parentPath,
        "de"
      ).pipe(Effect.flip);
      expect(missingCategoryAlternate).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
        locale: "de",
        publicPath: testArticleProjection.parentPath,
      });

      publishedMocks.articleRoute.mockReturnValueOnce(
        Effect.succeed({ activeReleaseId, alternates: [], projection: null })
      );
      const missingArticle = yield* read(
        testArticleProjection.publicPath,
        "de"
      ).pipe(Effect.flip);
      expect(missingArticle).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
        locale: "de",
        publicPath: testArticleProjection.publicPath,
      });

      publishedMocks.articleRoute.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          alternates: [testArticleProjection],
          projection: testArticleProjection,
        })
      );
      const missingArticleAlternate = yield* read(
        testArticleProjection.publicPath,
        "de"
      ).pipe(Effect.flip);
      expect(missingArticleAlternate).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
        locale: "de",
        publicPath: testArticleProjection.publicPath,
      });

      const malformedArticle = yield* read(
        "articles/politics/article/extra",
        "de"
      ).pipe(Effect.flip);
      expect(malformedArticle).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
        locale: "de",
        publicPath: "articles/politics/article/extra",
      });
    })
  );

  it.effect(
    "projects a material route through signed locale counterparts",
    () =>
      Effect.gen(function* () {
        const href = yield* readMaterialHref();

        expect(href).toBe(`/${previewIdProjection.publicPath}`);
        expect(publishedMocks.materialRoute).toHaveBeenCalledWith(
          "en",
          previewProjection.publicPath
        );
      })
  );

  it.effect("keeps only backend-verified material context", () =>
    Effect.gen(function* () {
      const search =
        "?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
      publishedMocks.materialContext
        .mockReturnValueOnce(Effect.succeed({ context: {} }))
        .mockReturnValueOnce(Effect.succeed(null));

      const verified = yield* readMaterialHref(search);
      expect(verified).toBe(`/${previewIdProjection.publicPath}${search}`);

      const omitted = yield* readMaterialHref(search);
      expect(omitted).toBe(`/${previewIdProjection.publicPath}`);
    })
  );

  it.effect(
    "fails closed for material tombstones and missing counterparts",
    () =>
      Effect.gen(function* () {
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

        const tombstone = yield* readMaterialHref().pipe(Effect.flip);
        expect(tombstone).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });

        const missingCounterpart = yield* readMaterialHref().pipe(Effect.flip);
        expect(missingCounterpart).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });
      })
  );

  it.effect(
    "projects signed curriculum counterparts and ignores static surfaces",
    () =>
      Effect.gen(function* () {
        const indonesian = yield* readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: testProgramSubject.publicPath,
          search: "",
        });
        expect(indonesian).toBe(`/${idProgramSubject.publicPath}`);

        const german = yield* readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: testProgramSubject.publicPath,
          search: "",
        });
        expect(german).toBe(`/${deProgramSubject.publicPath}`);

        const staticSurface = yield* readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "id",
          publicPath: "search",
          search: "",
        });
        expect(staticSurface).toBeNull();
      })
  );

  it.effect(
    "projects signed try-out counterparts and fails closed for tombstones",
    () =>
      Effect.gen(function* () {
        publishedMocks.tryoutPath
          .mockReturnValueOnce(
            Effect.succeed(
              "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
            )
          )
          .mockReturnValueOnce(Effect.succeed(null));
        const read = () =>
          readPublishedLocalizedHref({
            currentLocale: "id",
            hash: "",
            locale: "en",
            publicPath:
              "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
            search: "",
          });

        const href = yield* read();
        expect(href).toBe(
          "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
        );

        const tombstone = yield* read().pipe(Effect.flip);
        expect(tombstone).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });
      })
  );

  it.effect(
    "fails closed for curriculum tombstones and missing counterparts",
    () =>
      Effect.gen(function* () {
        publishedMocks.programRoute
          .mockReturnValueOnce(Effect.succeed({ alternates: [], route: null }))
          .mockReturnValueOnce(
            Effect.succeed({
              alternates: [testProgramSubject],
              route: testProgramSubject,
            })
          );
        const read = () =>
          readPublishedLocalizedHref({
            currentLocale: "en",
            hash: "",
            locale: "id",
            publicPath: testProgramSubject.publicPath,
            search: "",
          });

        const tombstone = yield* read().pipe(Effect.flip);
        expect(tombstone).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });

        const missingCounterpart = yield* read().pipe(Effect.flip);
        expect(missingCounterpart).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });
      })
  );

  it.effect(
    "projects signed Page counterparts and preserves safe URL state",
    () =>
      Effect.gen(function* () {
        publishedMocks.pagePath.mockReturnValueOnce(
          Effect.succeed({ kind: "found", publicPath: "impressum" })
        );

        const href = yield* readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "#company",
          locale: "de",
          publicPath: "legal-notice",
          search: "?source=footer",
        });
        expect(href).toBe("/impressum?source=footer#company");
        expect(publishedMocks.pagePath).toHaveBeenCalledWith({
          currentLocale: "en",
          locale: "de",
          publicPath: "legal-notice",
        });

        publishedMocks.pagePath.mockReturnValueOnce(
          Effect.succeed({ kind: "missing" })
        );
        const missing = yield* readPublishedLocalizedHref({
          currentLocale: "en",
          hash: "",
          locale: "de",
          publicPath: "legal-notice",
          search: "",
        }).pipe(Effect.flip);
        expect(missing).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
          locale: "de",
          publicPath: "legal-notice",
        });
      })
  );
});
