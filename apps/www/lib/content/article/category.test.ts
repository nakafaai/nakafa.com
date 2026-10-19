// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { Data, Effect, Option, Schema } from "effect";
import {
  getPublishedArticleCategory,
  getPublishedCategoryAlternates,
  getPublishedCategoryPage,
  hasPublishedArticleCategory,
  readPublishedArticleCategory,
  readPublishedCategoryAlternates,
  readPublishedCategoryPage,
} from "@/lib/content/article/category";
import { activateTestRelease } from "@/test/active";
import { resetTestRuntimeCache } from "@/test/store";

const categoryReaderMock = vi.hoisted(() => vi.fn());
const articleReaderMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const releaseCacheMock = vi.hoisted(() => vi.fn());
const manifestHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const releaseId = ReleaseIdSchema.make("release-article");

class TestCatalogError extends Data.TaggedError("TestCatalogError")<{
  readonly message: string;
}> {}

vi.mock("@/lib/content/article/catalog", () => ({
  readPublishedArticlePage: articleReaderMock,
  readPublishedCategories: categoryReaderMock,
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentCache: cacheMock,
  applyReleaseContentCache: releaseCacheMock,
}));
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@vercel/functions",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);

/** Builds one bounded category result from the signed catalog. */
function categoryPage({
  canonical = "politics",
  done = true,
  route = "politik",
  stale = false,
}: {
  readonly canonical?: string;
  readonly done?: boolean;
  readonly route?: string;
  readonly stale?: boolean;
} = {}) {
  return {
    activeManifestHash: manifestHash,
    activeReleaseId: releaseId,
    categories: [
      {
        category: ArticleCategorySchema.make(canonical),
        rendererDomain: Schema.decodeSync(RendererDomainSchema)("politics"),
        route: ArticleRouteSlugSchema.make(route),
        title: ArticleCategoryTitleSchema.make("Politics"),
      },
    ],
    done,
    nextCursor: done ? null : "next",
    sourceRevision: null,
    stale,
  };
}

/** Builds one localized category bound to a signed catalog generation. */
function categoryModel({
  canonical = "politics",
  locale = "en",
  route = "politics",
  title = "Politics",
}: {
  readonly canonical?: string;
  readonly locale?: "de" | "en" | "id";
  readonly route?: string;
  readonly title?: string;
} = {}) {
  return {
    activeManifestHash: manifestHash,
    activeReleaseId: releaseId,
    appLocale: locale,
    category: ArticleCategorySchema.make(canonical),
    rendererDomain: Schema.decodeSync(RendererDomainSchema)("politics"),
    route: ArticleRouteSlugSchema.make(route),
    title: ArticleCategoryTitleSchema.make(title),
  };
}

describe("published article category", () => {
  beforeEach(() => {
    resetTestRuntimeCache();
    activateTestRelease(releaseId);
    categoryReaderMock.mockReset();
    articleReaderMock.mockReset();
    cacheMock.mockReset();
    releaseCacheMock.mockReset();
  });

  it.effect(
    "answers the proxy, the pages and every locale from one list for each release",
    () =>
      Effect.gen(function* () {
        categoryReaderMock.mockReturnValue(Effect.succeed(categoryPage()));

        expect(yield* hasPublishedArticleCategory("politik", "de")).toBe(true);
        expect(yield* hasPublishedArticleCategory("politik", "de")).toBe(true);
        expect(yield* hasPublishedArticleCategory("missing", "de")).toBe(false);
        yield* readPublishedArticleCategory("politik", "de");
        yield* Effect.tryPromise(() =>
          getPublishedArticleCategory("politik", "de")
        );
        expect(categoryReaderMock).toHaveBeenCalledTimes(1);

        yield* hasPublishedArticleCategory("politik", "en");
        expect(categoryReaderMock).toHaveBeenCalledTimes(2);

        activateTestRelease("release-article-next");
        yield* hasPublishedArticleCategory("politik", "de");
        expect(categoryReaderMock).toHaveBeenCalledTimes(3);
      })
  );

  it.effect(
    "resolves one localized category and caches the framework adapter",
    () =>
      Effect.gen(function* () {
        categoryReaderMock.mockReturnValue(Effect.succeed(categoryPage()));

        const category = yield* Effect.tryPromise(() =>
          getPublishedArticleCategory("politik", "de")
        );
        expect(category).toMatchObject({
          _tag: "Some",
          value: { category: "politics", route: "politik" },
        });
        expect(yield* hasPublishedArticleCategory("politik", "de")).toBe(true);
        expect(cacheMock).toHaveBeenCalledWith("article");
      })
  );

  it.effect(
    "continues one release-bound category scan before finding a route",
    () =>
      Effect.gen(function* () {
        categoryReaderMock
          .mockReturnValueOnce(
            Effect.succeed(categoryPage({ done: false, route: "wissenschaft" }))
          )
          .mockReturnValueOnce(Effect.succeed(categoryPage()));

        const category = yield* readPublishedArticleCategory("politik", "de");
        expect(category).toMatchObject({
          _tag: "Some",
          value: { route: "politik" },
        });
        expect(categoryReaderMock).toHaveBeenNthCalledWith(2, {
          cursor: "next",
          expectedManifestHash: manifestHash,
          expectedReleaseId: releaseId,
          locale: "de",
        });
      })
  );

  it.effect("returns absence only after the complete signed catalog", () =>
    Effect.gen(function* () {
      categoryReaderMock.mockReturnValue(
        Effect.succeed(categoryPage({ route: "wissenschaft" }))
      );

      const category = yield* Effect.tryPromise(() =>
        getPublishedArticleCategory("politik", "de")
      );
      expect(Option.isNone(category)).toBe(true);
      expect(yield* hasPublishedArticleCategory("politik", "de")).toBe(false);
    })
  );

  it.effect("builds reciprocal category routes for every active locale", () =>
    Effect.gen(function* () {
      categoryReaderMock.mockImplementation(({ locale }: { locale: string }) =>
        Effect.succeed(
          categoryPage({
            route: locale === "de" ? "politik" : "politics",
          })
        )
      );

      const alternates = yield* Effect.tryPromise(() =>
        getPublishedCategoryAlternates(categoryModel())
      );
      expect(alternates).toEqual([
        { appLocale: "en", publicPath: "articles/politics" },
        { appLocale: "id", publicPath: "articles/politics" },
        { appLocale: "de", publicPath: "articles/politik" },
      ]);
      expect(releaseCacheMock).toHaveBeenCalledWith("article");
      expect(cacheMock).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects reciprocal routes assembled across signed releases", () =>
    Effect.gen(function* () {
      categoryReaderMock.mockImplementation(({ locale }: { locale: string }) =>
        Effect.succeed({
          ...categoryPage({
            route: locale === "de" ? "politik" : "politics",
          }),
          activeReleaseId: locale === "de" ? "release-next" : "release-article",
        })
      );

      const error = yield* readPublishedCategoryAlternates(
        categoryModel()
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "preserves an unchanged cached category after an unrelated release",
    () =>
      Effect.gen(function* () {
        categoryReaderMock.mockImplementation(
          ({ locale }: { locale: string }) =>
            Effect.succeed({
              ...categoryPage({
                route: locale === "de" ? "politik" : "politics",
              }),
              activeManifestHash: Sha256HashSchema.make(
                `sha256:${"b".repeat(64)}`
              ),
              activeReleaseId: ReleaseIdSchema.make("release-other-family"),
            })
        );

        expect(yield* readPublishedCategoryAlternates(categoryModel())).toEqual(
          [
            { appLocale: "en", publicPath: "articles/politics" },
            { appLocale: "id", publicPath: "articles/politics" },
            { appLocale: "de", publicPath: "articles/politik" },
          ]
        );
      })
  );

  it.effect(
    "rejects a changed current category in a fresh alternate catalog",
    () =>
      Effect.gen(function* () {
        categoryReaderMock.mockReturnValue(
          Effect.succeed(categoryPage({ route: "renamed-politics" }))
        );

        expect(
          yield* readPublishedCategoryAlternates(categoryModel()).pipe(
            Effect.flip
          )
        ).toMatchObject({ _tag: "PublishedProjectionError" });
      })
  );

  it.effect(
    "fails closed for invalid, stale, truncated, or incomplete routes",
    () =>
      Effect.gen(function* () {
        categoryReaderMock.mockReturnValueOnce(
          Effect.succeed(categoryPage({ stale: true }))
        );
        const staleError = yield* readPublishedArticleCategory(
          "politik",
          "de"
        ).pipe(Effect.flip);
        expect(staleError).toMatchObject({ _tag: "PublishedProjectionError" });

        categoryReaderMock.mockReturnValueOnce(
          Effect.succeed({
            ...categoryPage({ done: false, route: "wissenschaft" }),
            nextCursor: null,
          })
        );
        const truncatedError = yield* readPublishedArticleCategory(
          "politik",
          "de"
        ).pipe(Effect.flip);
        expect(truncatedError).toMatchObject({
          _tag: "PublishedProjectionError",
        });

        const invalidRouteError = yield* readPublishedArticleCategory(
          "Ungültig",
          "de"
        ).pipe(Effect.flip);
        expect(invalidRouteError).toMatchObject({
          _tag: "PublishedProjectionError",
        });

        categoryReaderMock.mockReturnValue(
          Effect.succeed(categoryPage({ canonical: "science" }))
        );
        const incompleteError = yield* readPublishedCategoryAlternates(
          categoryModel()
        ).pipe(Effect.flip);
        expect(incompleteError).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      })
  );

  it.effect(
    "preserves category identity and stale-cursor handling across releases",
    () =>
      Effect.gen(function* () {
        const model = categoryModel({ locale: "de", route: "politik" });
        const page = {
          activeManifestHash: manifestHash,
          activeReleaseId: releaseId,
          articles: [
            {
              authors: [{ name: "Nakafa" }],
              category: "politics",
              categoryTitle: "Politics",
              datePublished: "2026-08-22",
              description: "Article",
              official: true,
              publicPath: "articles/politik/artikel",
              route: { category: "politik", slug: "artikel" },
              title: "Artikel",
            },
          ],
          done: true,
          nextCursor: null,
          sourceRevision: null,
          stale: false,
        };
        articleReaderMock.mockReturnValue(Effect.succeed(page));

        const category = yield* Effect.tryPromise(() =>
          getPublishedCategoryPage(model, {
            cursor: null,
            expectedManifestHash: null,
            expectedReleaseId: null,
          })
        );
        expect(category).toEqual(page);
        expect(releaseCacheMock).toHaveBeenCalledWith("article");
        expect(cacheMock).not.toHaveBeenCalled();

        const stalePage = { ...page, stale: true };
        articleReaderMock.mockReturnValueOnce(Effect.succeed(stalePage));
        const staleCategory = yield* readPublishedCategoryPage(model, {
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
        });
        expect(staleCategory).toEqual(stalePage);

        const nextPage = {
          ...page,
          activeManifestHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
          activeReleaseId: ReleaseIdSchema.make("release-other-family"),
        };
        articleReaderMock.mockReturnValueOnce(Effect.succeed(nextPage));
        expect(
          yield* readPublishedCategoryPage(model, {
            cursor: null,
            expectedManifestHash: null,
            expectedReleaseId: null,
          })
        ).toEqual(nextPage);

        const mismatches = [
          {
            ...page,
            articles: [{ ...page.articles[0], category: "science" }],
          },
          {
            ...page,
            articles: [{ ...page.articles[0], categoryTitle: "Politik" }],
          },
          {
            ...page,
            articles: [
              {
                ...page.articles[0],
                route: { category: "wissenschaft", slug: "artikel" },
              },
            ],
          },
        ];

        for (const mismatch of mismatches) {
          articleReaderMock.mockReturnValueOnce(Effect.succeed(mismatch));
          const error = yield* readPublishedCategoryPage(model, {
            cursor: null,
            expectedManifestHash: null,
            expectedReleaseId: null,
          }).pipe(Effect.flip);
          expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
        }
      })
  );

  it.effect("preserves catalog failures in the Effect error channel", () =>
    Effect.gen(function* () {
      categoryReaderMock.mockReturnValue(
        Effect.fail(new TestCatalogError({ message: "category unavailable" }))
      );

      const error = yield* readPublishedArticleCategory("politik", "id").pipe(
        Effect.flip
      );
      expect(error).toMatchObject({
        _tag: "TestCatalogError",
        message: "category unavailable",
      });
    })
  );
});
