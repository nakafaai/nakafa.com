import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Effect, Option } from "effect";
import { resolveLocalizedNavigationHref } from "@/lib/routing/locale/resolve";
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
const activeReleaseId = ReleaseIdSchema.make("release-material");
const articleProjections = [
  testArticleProjection,
  testArticleIdProjection,
  testArticleDeProjection,
];
const activeMaterialRoute = {
  activeReleaseId,
  alternates: [previewProjection, previewIdProjection],
  projection: previewProjection,
};
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
/** Resolves a localized href through the Effect boundary used by callers. */
function resolveHref(href: string, locale: ActiveAppLocaleCode) {
  return resolveLocalizedNavigationHref({ href, locale });
}

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
  publishedMocks.materialContext
    .mockReset()
    .mockReturnValue(Effect.succeed(null));
  publishedMocks.materialRoute
    .mockReset()
    .mockReturnValue(Effect.succeed(activeMaterialRoute));
  publishedMocks.pagePath
    .mockReset()
    .mockReturnValue(Effect.succeed({ kind: "unmanaged" }));
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
  it.effect("projects every EN, ID, and DE article route direction", () =>
    Effect.gen(function* () {
      for (const current of articleProjections) {
        for (const target of articleProjections) {
          if (current.appLocale === target.appLocale) {
            continue;
          }

          const category = yield* resolveHref(
            `/${current.appLocale}/${current.parentPath}`,
            target.appLocale
          );
          expect(category).toBe(`/${target.parentPath}`);

          const article = yield* resolveHref(
            `/${current.appLocale}/${current.publicPath}`,
            target.appLocale
          );
          expect(article).toBe(`/${target.publicPath}`);
        }
      }

      const articleWithState = yield* resolveHref(
        `/${testArticleProjection.appLocale}/${testArticleProjection.publicPath}?source=locale#references`,
        "de"
      );
      expect(articleWithState).toBe(
        `/${testArticleDeProjection.publicPath}?source=locale#references`
      );

      const categoryWithState = yield* resolveHref(
        `/${testArticleProjection.appLocale}/${testArticleProjection.parentPath}?cursor=source&manifest=source&release=source&source=locale#latest`,
        "de"
      );
      expect(categoryWithState).toBe(
        `/${testArticleDeProjection.parentPath}?source=locale#latest`
      );
    })
  );

  it.effect("projects signed material and curriculum counterparts", () =>
    Effect.gen(function* () {
      const material = yield* resolveHref(
        `/${previewProjection.appLocale}/${previewProjection.publicPath}`,
        "id"
      );
      expect(material).toBe(`/${previewIdProjection.publicPath}`);

      publishedMocks.programRoute.mockReturnValue(
        Effect.succeed({
          alternates: [testProgramSubject, idProgramSubject, deProgramSubject],
          route: testProgramSubject,
        })
      );
      const indonesian = yield* resolveHref(
        `/${testProgramSubject.appLocale}/${testProgramSubject.publicPath}`,
        "id"
      );
      expect(indonesian).toBe(`/${idProgramSubject.publicPath}`);

      const german = yield* resolveHref(
        `/${testProgramSubject.appLocale}/${testProgramSubject.publicPath}`,
        "de"
      );
      expect(german).toBe(`/${deProgramSubject.publicPath}`);
    })
  );

  it.effect(
    "keeps material context only while the signed program verifies it",
    () =>
      Effect.gen(function* () {
        const href = `/${previewProjection.appLocale}/${previewProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`;
        publishedMocks.materialContext
          .mockReturnValueOnce(Effect.succeed({ context: {} }))
          .mockReturnValueOnce(Effect.succeed(null));

        const verified = yield* resolveHref(href, "id");
        expect(verified).toBe(
          `/${previewIdProjection.publicPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`
        );

        const omitted = yield* resolveHref(href, "id");
        expect(omitted).toBe(`/${previewIdProjection.publicPath}`);
      })
  );

  it.effect(
    "preserves verified context across signed material route renames",
    () =>
      Effect.gen(function* () {
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

        const href = yield* resolveHref(
          `/en/${currentPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`,
          "id"
        );
        expect(href).toBe(
          `/${targetPath}?ctx=merdeka~class-11-mathematics-function-composition-inverse-function`
        );
      })
  );

  it.effect("fails closed for signed tombstones and missing locale rows", () =>
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
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failure = yield* resolveLocalizedNavigationHref({
          href: `/${previewProjection.appLocale}/${previewProjection.publicPath}`,
          locale: "id",
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });
      }

      publishedMocks.programRoute
        .mockReturnValueOnce(Effect.succeed({ alternates: [], route: null }))
        .mockReturnValueOnce(
          Effect.succeed({ alternates: [], route: testProgramSubject })
        );
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failure = yield* resolveLocalizedNavigationHref({
          href: `/${testProgramSubject.appLocale}/${testProgramSubject.publicPath}`,
          locale: "id",
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "MissingLocalizedRouteProjectionError",
        });
      }
    })
  );

  it.effect("projects mapped curriculum and tryout paths", () =>
    Effect.gen(function* () {
      const englishCurriculum = yield* resolveHref("/id/kurikulum", "en");
      expect(englishCurriculum).toBe("/curriculum");

      const indonesianCurriculum = yield* resolveHref("/en/curriculum", "id");
      expect(indonesianCurriculum).toBe("/kurikulum");

      const tryout = yield* resolveHref("/id/try-out/indonesia", "en");
      expect(tryout).toBe("/try-out/indonesia");

      const section = yield* resolveHref(
        "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
        "en"
      );
      expect(section).toBe(
        "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
      );
    })
  );

  it.effect("projects signed Page identities across German route changes", () =>
    Effect.gen(function* () {
      publishedMocks.pagePath.mockReturnValueOnce(
        Effect.succeed({ kind: "found", publicPath: "impressum" })
      );

      const href = yield* resolveHref(
        "/en/legal-notice?source=footer#company",
        "de"
      );
      expect(href).toBe("/impressum?source=footer#company");
    })
  );

  it.effect("keeps static app routes and safe URL state", () =>
    Effect.gen(function* () {
      const search = yield* resolveHref("/id/search?q=vektor#results", "en");
      expect(search).toBe("/search?q=vektor#results");

      const home = yield* resolveHref("/en/home", "id");
      expect(home).toBe("/home");

      const unlocalizedSearch = yield* resolveHref("/search?q=vektor", "en");
      expect(unlocalizedSearch).toBe("/search?q=vektor");

      const currentLocale = yield* resolveHref("/id/search", "id");
      expect(currentLocale).toBe("/search");

      const englishRoot = yield* resolveHref("/id", "en");
      expect(englishRoot).toBe("/");

      const indonesianRoot = yield* resolveHref("/en", "id");
      expect(indonesianRoot).toBe("/");

      const preview = yield* resolveHref(
        "/id/internal-preview/alpha?source=meeting#top",
        "en"
      );
      expect(preview).toBe("/internal-preview/alpha?source=meeting#top");
    })
  );

  it.effect("fails malformed and missing projected routes", () =>
    Effect.gen(function* () {
      const invalid = yield* resolveLocalizedNavigationHref({
        href: "http://[",
        locale: "en",
      }).pipe(Effect.flip);
      expect(invalid).toMatchObject({
        _tag: "InvalidLocalizedHrefError",
        href: "http://[",
      });

      publishedMocks.materialRoute.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          alternates: [],
          projection: null,
        })
      );
      const material = yield* resolveLocalizedNavigationHref({
        href: "/id/materi/fisika/tidak-ada",
        locale: "en",
      }).pipe(Effect.flip);
      expect(material).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
      });

      const missingTryout = yield* resolveLocalizedNavigationHref({
        href: "/id/try-out/tidak-ada",
        locale: "en",
      }).pipe(Effect.flip);
      expect(missingTryout).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
      });

      const untranslatedTryout = yield* resolveLocalizedNavigationHref({
        href: "/id/try-out/indonesia/untranslated",
        locale: "en",
      }).pipe(Effect.flip);
      expect(untranslatedTryout).toMatchObject({
        _tag: "MissingLocalizedRouteProjectionError",
      });
    })
  );
});
