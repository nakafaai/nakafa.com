// @vitest-environment node

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import type { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
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
const runtimeQueryMock = vi.hoisted(() => vi.fn());
const revision = "a".repeat(40);
const activeManifestHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const activeReleaseId = ReleaseIdSchema.make("release-article");
const staleManifestHash = Sha256HashSchema.make(`sha256:${"c".repeat(64)}`);
const staleReleaseId = ReleaseIdSchema.make("release-old");
type ArticleRow = FunctionReturnType<
  typeof api.contentRelease.article.publications
>["result"]["page"][number];
type CategoryRow = FunctionReturnType<
  typeof api.contentRelease.article.categories
>["result"]["page"][number];

/** Builds one backend projection row from a reviewed article projection. */
function articleRow(selected = testArticleProjection): ArticleRow {
  return {
    appLocale: selected.appLocale,
    artifactLocale: selected.artifactLocale,
    contentKey: selected.contentKey,
    family: "article",
    projectionHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
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
    activeManifestHash,
    activeReleaseId,
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
  readonly route?: string;
  readonly title?: string;
}): CategoryRow {
  return {
    category: overrides?.category ?? "politics",
    rendererDomain: "politics",
    route: ArticleRouteSlugSchema.make(overrides?.route ?? "politics"),
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
    activeManifestHash,
    activeReleaseId,
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

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published article catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    runtimeQueryMock.mockReset();
  });

  it("decodes newest articles and preserves release-bound pagination", async () => {
    const older = makeTestArticleProjection("older-politics", "2023-01-01");
    const metadata = testArticleProjection.metadata;
    const updated = ArticleProjectionSchema.make({
      ...testArticleProjection,
      metadata: {
        ...metadata,
        dateModified: "2026-08-22",
      },
    });
    runtimeQueryMock.mockResolvedValueOnce(
      articlePage({
        isDone: false,
        page: [articleRow(updated), articleRow(older)],
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
      activeReleaseId,
      articles: [
        {
          categoryTitle: "Politics",
          dateModified: "2026-08-22",
          route: {
            category: testArticleProjection.categoryRouteSlug,
            slug: testArticleProjection.articleRouteSlug,
          },
        },
        {
          route: {
            category: older.categoryRouteSlug,
            slug: older.articleRouteSlug,
          },
        },
      ],
      done: false,
      nextCursor: "next",
      sourceRevision: null,
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "en",
      category: "politics",
      expectedManifestHash: null,
      expectedReleaseId: null,
      paginationOpts: { cursor: null, numItems: PROJECTION_PAGE_LIMIT },
    });
    expect(cacheMock).toHaveBeenCalledWith("article");
  });

  it("decodes source-owned category titles without UI fallbacks", async () => {
    runtimeQueryMock.mockResolvedValueOnce(categoryPage());

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
          route: "politics",
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
    const metadata = testArticleProjection.metadata;
    const projection = ArticleProjectionSchema.make({
      ...testArticleProjection,
      metadata: {
        authors: metadata.authors,
        datePublished: metadata.datePublished,
        title: metadata.title,
      },
    });
    runtimeQueryMock
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

    expect(articleResult.nextCursor).toBeNull();
    expect(articleResult.articles[0]).not.toHaveProperty("description");
    expect(categoryResult.nextCursor).toBe("next");
  });

  it("preserves a stale cursor response for the route redirect boundary", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce(articlePage({ page: [], stale: true }))
      .mockResolvedValueOnce(categoryPage({ stale: true }));

    const [articles, categories] = await Effect.runPromise(
      Effect.all([
        readPublishedArticlePage({
          category: testArticleProjection.category,
          cursor: "old-article-cursor",
          expectedManifestHash: staleManifestHash,
          expectedReleaseId: staleReleaseId,
          locale: "en",
        }),
        readPublishedCategories({
          cursor: "old-category-cursor",
          expectedManifestHash: staleManifestHash,
          expectedReleaseId: staleReleaseId,
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
    ["foreign app locale", { ...articleRow(), appLocale: "id" }],
    ["foreign key", { ...articleRow(), contentKey: "articles/other" }],
    ["foreign route", { ...articleRow(), publicPath: "articles/other" }],
  ])("rejects %s article rows", async (_name, row) => {
    runtimeQueryMock.mockResolvedValueOnce(articlePage({ page: [row] }));

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
    runtimeQueryMock.mockResolvedValueOnce(response);

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
    runtimeQueryMock
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

  it("rejects a malformed active generation identity", async () => {
    runtimeQueryMock.mockResolvedValueOnce({
      ...articlePage(),
      activeManifestHash: "sha256:invalid",
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
  });

  it("rejects unmanaged article and category catalogs", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({
        ...articlePage({ page: [] }),
        activeManifestHash: null,
        activeReleaseId: null,
        managed: false,
      })
      .mockResolvedValueOnce({
        ...categoryPage(),
        activeManifestHash: null,
        activeReleaseId: null,
        managed: false,
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
    runtimeQueryMock.mockRejectedValueOnce(failure);

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
