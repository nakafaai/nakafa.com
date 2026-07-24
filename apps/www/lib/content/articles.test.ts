// @vitest-environment node

import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleProjectionSchema,
  ArticleSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getArticleSourceDirectory,
  getPublishedArticlePage,
  readPublishedArticlePage,
  selectArticleCategories,
  selectCategoryArticles,
} from "@/lib/content/articles";
import { makeArticleGraph } from "@/test/content-preview";

const cacheMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const sourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx"
);

/** Builds one real-route article projection with caller-owned list metadata. */
function articleProjection(
  slugValue = "dynastic-politics-asian-values",
  date = "2024-09-20"
) {
  const slug = ArticleSlugSchema.make(slugValue);
  const publicPath = PublicPathSchema.make(`articles/politics/${slug}`);
  return ArticleProjectionSchema.make({
    articleSlug: slug,
    category: "politics",
    contentKey: ContentKeySchema.make(publicPath),
    graph: makeArticleGraph(slug, "en"),
    kind: "article",
    locale: "en",
    metadata: {
      authors: [{ name: "Nabil Akbarazzima Fatih" }],
      date,
      description:
        "Political dynasties are growing. Their influence brings risks to democracy and good governance.",
      title: `Dynastic Politics ${slugValue}`,
    },
    official: true,
    parentPath: PublicPathSchema.make("articles/politics"),
    publicPath,
    references: [],
    sitemap: true,
  });
}

const projection = articleProjection();

/** Builds one successful bounded backend response for an article projection. */
function articlePage(
  selected = projection,
  overrides?: {
    readonly projectionJson?: string;
    readonly sourcePath?: string;
    readonly sourceRevision?: null | string;
  }
) {
  return {
    activeReleaseId: "release-article",
    done: true,
    items: [
      {
        projectionJson:
          overrides?.projectionJson ?? canonicalizeArticleProjection(selected),
        sourcePath: overrides?.sourcePath ?? sourcePath,
      },
    ],
    nextCursor: null,
    sourceRevision:
      overrides?.sourceRevision === undefined
        ? "a".repeat(40)
        : overrides.sourceRevision,
  };
}

/** Runs one decoded article catalog read at the test boundary. */
function readPage() {
  return Effect.runPromise(
    readPublishedArticlePage({ cursor: null, locale: "en" })
  );
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  fetchRuntimeQuery: fetchMock,
  readRuntimeQuery: (_name: string, read: () => Promise<unknown>) =>
    Effect.tryPromise({
      try: read,
      catch: (cause) => cause,
    }),
}));

describe("published article catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    fetchMock.mockReset().mockResolvedValue(articlePage());
  });

  it("decodes active article summaries and caches only the catalog family", async () => {
    const page = await getPublishedArticlePage({
      cursor: null,
      locale: "en",
    });

    expect(page).toMatchObject({
      activeReleaseId: "release-article",
      articles: [
        {
          category: "politics",
          publicPath: projection.publicPath,
          slug: projection.articleSlug,
          sourcePath,
          sourceRevision: "a".repeat(40),
        },
      ],
      done: true,
      nextCursor: null,
    });
    expect(cacheMock).toHaveBeenCalledWith("article");
  });

  it("keeps rollback provenance absent and selects stable list views", async () => {
    const older = articleProjection("older-politics", "2023-01-01");
    fetchMock.mockResolvedValueOnce({
      ...articlePage(projection, { sourceRevision: null }),
      items: [articlePage(older).items[0], articlePage(projection).items[0]],
    });
    const page = await readPage();
    const selected = selectCategoryArticles(page.articles, "politics");
    const categories = selectArticleCategories(page.articles);

    expect(selected.map((article) => article.slug)).toEqual([
      projection.articleSlug,
      older.articleSlug,
    ]);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.sourceRevision).toBeNull();
    const newest = selected[0];
    if (!newest) {
      throw new Error("Expected one selected article.");
    }
    expect(getArticleSourceDirectory(newest, "root")).toBe(
      "packages/corpus/articles"
    );
    expect(getArticleSourceDirectory(newest, "category")).toBe(
      "packages/corpus/articles/politics"
    );
  });

  it.each([
    ["invalid JSON", { projectionJson: "{" }],
    ["invalid projection", { projectionJson: "{}" }],
    ["invalid revision", { sourceRevision: "main" }],
    ["invalid source path", { sourcePath: "outside.mdx" }],
    [
      "foreign source",
      { sourcePath: "packages/corpus/material/lesson/example/en.mdx" },
    ],
    [
      "foreign locale",
      {
        projectionJson: canonicalizeArticleProjection({
          ...projection,
          locale: "id",
        }),
      },
    ],
  ])("rejects %s instead of inventing catalog data", async (_name, overrides) => {
    fetchMock.mockResolvedValueOnce(articlePage(projection, overrides));

    await expect(
      Effect.runPromise(
        readPublishedArticlePage({
          cursor: null,
          locale: "en",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
    });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    const failure = new Error("catalog unavailable");
    fetchMock.mockRejectedValueOnce(failure);

    await expect(readPage()).rejects.toThrow(failure.message);
  });
});
