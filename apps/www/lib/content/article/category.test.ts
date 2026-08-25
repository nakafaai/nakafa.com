// @vitest-environment node

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
import { Data, Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedArticleCategory,
  getPublishedCategoryAlternates,
  getPublishedCategoryPage,
  hasPublishedArticleCategory,
  readPublishedArticleCategory,
  readPublishedCategoryAlternates,
  readPublishedCategoryPage,
} from "@/lib/content/article/category";

const categoryReaderMock = vi.hoisted(() => vi.fn());
const articleReaderMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
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
  applyPublishedCatalogCache: cacheMock,
}));

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
    categoryReaderMock.mockReset();
    articleReaderMock.mockReset();
    cacheMock.mockReset();
  });

  it("resolves one localized category and caches the framework adapter", async () => {
    categoryReaderMock.mockReturnValue(Effect.succeed(categoryPage()));

    await expect(
      getPublishedArticleCategory("politik", "de")
    ).resolves.toMatchObject({ category: "politics", route: "politik" });
    await expect(
      Effect.runPromise(hasPublishedArticleCategory("politik", "de"))
    ).resolves.toBe(true);
    expect(cacheMock).toHaveBeenCalledWith("article");
  });

  it("continues one release-bound category scan before finding a route", async () => {
    categoryReaderMock
      .mockReturnValueOnce(
        Effect.succeed(categoryPage({ done: false, route: "wissenschaft" }))
      )
      .mockReturnValueOnce(Effect.succeed(categoryPage()));

    await expect(
      Effect.runPromise(readPublishedArticleCategory("politik", "de"))
    ).resolves.toMatchObject({ _tag: "Some", value: { route: "politik" } });
    expect(categoryReaderMock).toHaveBeenNthCalledWith(2, {
      cursor: "next",
      expectedManifestHash: manifestHash,
      expectedReleaseId: releaseId,
      locale: "de",
    });
  });

  it("returns absence only after the complete signed catalog", async () => {
    categoryReaderMock.mockReturnValue(
      Effect.succeed(categoryPage({ route: "wissenschaft" }))
    );

    await expect(
      getPublishedArticleCategory("politik", "de")
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(hasPublishedArticleCategory("politik", "de"))
    ).resolves.toBe(false);
  });

  it("builds reciprocal category routes for every active locale", async () => {
    categoryReaderMock.mockImplementation(({ locale }: { locale: string }) =>
      Effect.succeed(
        categoryPage({ route: locale === "de" ? "politik" : "politics" })
      )
    );

    await expect(
      getPublishedCategoryAlternates(categoryModel())
    ).resolves.toEqual([
      { appLocale: "en", publicPath: "articles/politics" },
      { appLocale: "id", publicPath: "articles/politics" },
      { appLocale: "de", publicPath: "articles/politik" },
    ]);
    expect(cacheMock).toHaveBeenCalledWith("article");
  });

  it("rejects reciprocal routes assembled across signed releases", async () => {
    categoryReaderMock.mockImplementation(({ locale }: { locale: string }) =>
      Effect.succeed({
        ...categoryPage({ route: locale === "de" ? "politik" : "politics" }),
        activeReleaseId: locale === "de" ? "release-next" : "release-article",
      })
    );

    await expect(
      Effect.runPromise(readPublishedCategoryAlternates(categoryModel()))
    ).rejects.toThrow();
  });

  it("fails closed for invalid, stale, truncated, or incomplete routes", async () => {
    categoryReaderMock.mockReturnValueOnce(
      Effect.succeed(categoryPage({ stale: true }))
    );
    await expect(
      Effect.runPromise(readPublishedArticleCategory("politik", "de"))
    ).rejects.toThrow();

    categoryReaderMock.mockReturnValueOnce(
      Effect.succeed({
        ...categoryPage({ done: false, route: "wissenschaft" }),
        nextCursor: null,
      })
    );
    await expect(
      Effect.runPromise(readPublishedArticleCategory("politik", "de"))
    ).rejects.toThrow();

    await expect(
      Effect.runPromise(readPublishedArticleCategory("Ungültig", "de"))
    ).rejects.toThrow();

    categoryReaderMock.mockReturnValue(
      Effect.succeed(categoryPage({ canonical: "science" }))
    );
    await expect(
      Effect.runPromise(readPublishedCategoryAlternates(categoryModel()))
    ).rejects.toThrow();
  });

  it("keeps category pages on the same signed locale generation", async () => {
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

    await expect(
      getPublishedCategoryPage(model, {
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
      })
    ).resolves.toEqual(page);
    expect(cacheMock).toHaveBeenCalledWith("article");

    const stalePage = { ...page, stale: true };
    articleReaderMock.mockReturnValueOnce(Effect.succeed(stalePage));
    await expect(
      Effect.runPromise(
        readPublishedCategoryPage(model, {
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
        })
      )
    ).resolves.toEqual(stalePage);

    const mismatches = [
      { ...page, activeManifestHash: `sha256:${"b".repeat(64)}` },
      { ...page, activeReleaseId: "release-next" },
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
      await expect(
        Effect.runPromise(
          readPublishedCategoryPage(model, {
            cursor: null,
            expectedManifestHash: null,
            expectedReleaseId: null,
          })
        )
      ).rejects.toThrow();
    }
  });

  it("preserves catalog failures in the Effect error channel", async () => {
    categoryReaderMock.mockReturnValue(
      Effect.fail(new TestCatalogError({ message: "category unavailable" }))
    );

    await expect(
      Effect.runPromise(readPublishedArticleCategory("politik", "id"))
    ).rejects.toThrow("category unavailable");
  });
});
