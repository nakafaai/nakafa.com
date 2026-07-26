// @vitest-environment node

import {
  ArticleProjectionSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedArticlePage,
  getPublishedCategories,
  readPublishedArticlePage,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import {
  makeTestArticleProjection,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";

const cacheMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const revision = "a".repeat(40);
type ArticleRow = FunctionReturnType<
  typeof api.contentRelease.article.page
>["result"]["page"][number];
type CategoryRow = FunctionReturnType<
  typeof api.contentRelease.article.categories
>["result"]["page"][number];

/** Builds one backend projection row from a reviewed article projection. */
function articleRow(selected = testArticleProjection): ArticleRow {
  return {
    contentKey: selected.contentKey,
    family: "article",
    locale: selected.locale,
    projectionHash: `sha256:${"b".repeat(64)}`,
    projectionJson: canonicalizeArticleProjection(selected),
    publicPath: selected.publicPath,
    releaseId: "release-article",
    rendererDomain: "politics",
    sequence: 2,
    sourcePath: testArticleSourcePath,
  };
}

/** Builds one successful article page from the active read model. */
function articlePage(overrides?: {
  readonly isDone?: boolean;
  readonly page?: readonly unknown[];
  readonly sourceRevision?: null | string;
  readonly stale?: boolean;
}) {
  return {
    activeManifestHash: `sha256:${"a".repeat(64)}`,
    activeReleaseId: "release-article",
    managed: true,
    result: {
      continueCursor: "next",
      isDone: overrides?.isDone ?? true,
      page: overrides?.page ?? [articleRow()],
    },
    sourceRevision:
      overrides?.sourceRevision === undefined
        ? revision
        : overrides.sourceRevision,
    stale: overrides?.stale ?? false,
  };
}

/** Builds one backend category row from reviewed article metadata. */
function categoryRow(overrides?: {
  readonly category?: string;
  readonly title?: string;
}): CategoryRow {
  return {
    category: overrides?.category ?? "politics",
    rendererDomain: "politics",
    title: overrides?.title ?? "Politics",
  };
}

/** Builds one successful category page from the active read model. */
function categoryPage(overrides?: {
  readonly category?: string;
  readonly isDone?: boolean;
  readonly stale?: boolean;
  readonly title?: string;
}) {
  return {
    activeManifestHash: `sha256:${"a".repeat(64)}`,
    activeReleaseId: "release-article",
    managed: true,
    result: {
      continueCursor: "next",
      isDone: overrides?.isDone ?? true,
      page: [categoryRow(overrides)],
    },
    sourceRevision: revision,
    stale: overrides?.stale ?? false,
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

describe("published article catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    fetchMock.mockReset();
  });

  it("decodes newest articles and preserves release-bound pagination", async () => {
    const older = makeTestArticleProjection("older-politics", "2023-01-01");
    fetchMock.mockResolvedValueOnce(
      articlePage({
        isDone: false,
        page: [articleRow(testArticleProjection), articleRow(older)],
        sourceRevision: null,
      })
    );

    const page = await getPublishedArticlePage({
      category: testArticleProjection.category,
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
    });

    expect(page).toMatchObject({
      activeReleaseId: "release-article",
      articles: [
        {
          categoryTitle: "Politics",
          slug: testArticleProjection.articleSlug,
        },
        { slug: older.articleSlug },
      ],
      done: false,
      managed: true,
      nextCursor: "next",
      sourceRevision: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), {
      category: "politics",
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
      paginationOpts: { cursor: null, numItems: 32 },
    });
    expect(cacheMock).toHaveBeenCalledWith("article");
  });

  it("decodes source-owned category titles without UI fallbacks", async () => {
    fetchMock.mockResolvedValueOnce(categoryPage());

    const page = await getPublishedCategories({
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
    });

    expect(page).toMatchObject({
      categories: [
        {
          category: "politics",
          rendererDomain: "politics",
          title: "Politics",
        },
      ],
      done: true,
      nextCursor: null,
      sourceRevision: revision,
    });
    expect(cacheMock).toHaveBeenCalledWith("article");
  });

  it("preserves optional descriptions and both terminal cursor states", async () => {
    const projection = ArticleProjectionSchema.make({
      ...testArticleProjection,
      metadata: {
        authors: testArticleProjection.metadata.authors,
        date: testArticleProjection.metadata.date,
        title: testArticleProjection.metadata.title,
      },
    });
    fetchMock
      .mockResolvedValueOnce(articlePage({ page: [articleRow(projection)] }))
      .mockResolvedValueOnce(categoryPage({ isDone: false }));

    const articleResult = await Effect.runPromise(
      readPublishedArticlePage({
        category: projection.category,
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
      })
    );
    const categoryResult = await Effect.runPromise(
      readPublishedCategories({
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
      })
    );

    expect(articleResult).toMatchObject({
      articles: [{ description: "" }],
      nextCursor: null,
    });
    expect(categoryResult.nextCursor).toBe("next");
  });

  it("preserves a stale cursor response for the route redirect boundary", async () => {
    fetchMock
      .mockResolvedValueOnce(articlePage({ page: [], stale: true }))
      .mockResolvedValueOnce(categoryPage({ stale: true }));

    const [articles, categories] = await Effect.runPromise(
      Effect.all([
        readPublishedArticlePage({
          category: testArticleProjection.category,
          cursor: "old-article-cursor",
          expectedManifestHash: `sha256:${"c".repeat(64)}`,
          expectedReleaseId: "release-old",
          locale: "en",
        }),
        readPublishedCategories({
          cursor: "old-category-cursor",
          expectedManifestHash: `sha256:${"c".repeat(64)}`,
          expectedReleaseId: "release-old",
          locale: "en",
        }),
      ])
    );

    expect(articles.stale).toBe(true);
    expect(categories.stale).toBe(true);
  });

  it.each([
    ["invalid JSON", { ...articleRow(), projectionJson: "{" }],
    ["invalid projection", { ...articleRow(), projectionJson: "{}" }],
    ["foreign family", { ...articleRow(), family: "material" }],
    ["foreign locale", { ...articleRow(), locale: "id" }],
    ["foreign key", { ...articleRow(), contentKey: "articles/other" }],
    ["foreign route", { ...articleRow(), publicPath: "articles/other" }],
  ])("rejects %s article rows", async (_name, row) => {
    fetchMock.mockResolvedValueOnce(articlePage({ page: [row] }));

    await expect(
      Effect.runPromise(
        readPublishedArticlePage({
          category: testArticleProjection.category,
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it.each([
    ["invalid category", categoryPage({ category: "Politics" })],
    ["empty title", categoryPage({ title: "" })],
    ["invalid source revision", { ...categoryPage(), sourceRevision: "main" }],
  ])("rejects %s rows", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response);

    await expect(
      Effect.runPromise(
        readPublishedCategories({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("rejects continuation pages without a complete release identity", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ...articlePage({ isDone: false }),
        activeManifestHash: null,
      })
      .mockResolvedValueOnce({
        ...categoryPage({ isDone: false }),
        activeReleaseId: null,
      });

    await expect(
      Effect.runPromise(
        readPublishedArticlePage({
          category: testArticleProjection.category,
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(
        readPublishedCategories({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    const failure = new Error("catalog unavailable");
    fetchMock.mockRejectedValueOnce(failure);

    await expect(
      Effect.runPromise(
        readPublishedCategories({
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale: "en",
        })
      )
    ).rejects.toThrow(failure.message);
  });
});
