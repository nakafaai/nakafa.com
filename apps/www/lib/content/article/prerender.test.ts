// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import { createTestPublication } from "@repo/backend/test/content/publication";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { readPublishedArticlePrerenderRoute } from "@/lib/content/article/prerender";
import { makeArticleRuntimeSource } from "@/test/content/article";
import {
  makeTestArticleProjection,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import {
  createTestNativeQuery,
  createTestRuntimeQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const generation = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "release-article",
  managed: true,
  sourceRevision: GitCommitShaSchema.make("a".repeat(40)),
  stale: false,
};
type ArticleRow = FunctionReturnType<
  typeof api.contentRelease.article.publications
>["result"]["page"][number];

vi.mock("@/lib/content/cache", () => ({
  applyContentCache: vi.fn(),
}));
vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: runtimeReadMock,
}));

/** Provides a category page with more inventory beyond its first bounded read. */
function categoryPage(): FunctionReturnType<
  typeof api.contentRelease.article.categories
> {
  return {
    ...generation,
    result: {
      continueCursor: "more-categories",
      isDone: false,
      page: [
        {
          category: testArticleProjection.category,
          rendererDomain: "politics",
          route: testArticleProjection.categoryRouteSlug,
          title: testArticleProjection.categoryTitle,
        },
      ],
    },
  };
}

/** Provides two real articles while retaining a continuation cursor. */
function articlePage(): FunctionReturnType<
  typeof api.contentRelease.article.publications
> {
  return {
    ...generation,
    result: {
      continueCursor: "more-articles",
      isDone: false,
      page: [
        testArticleProjection,
        makeTestArticleProjection("older", "2023-01-01"),
      ].map(
        (projection): ArticleRow => ({
          appLocale: projection.appLocale,
          artifactLocale: projection.artifactLocale,
          contentKey: projection.contentKey,
          family: "article",
          projectionHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
          projectionJson: canonicalizeArticleProjection(projection),
          publicPath: projection.publicPath,
          releaseId: generation.activeReleaseId,
          rendererDomain: "politics",
          sequence: 2,
          sourcePath: testArticleSourcePath,
        })
      ),
    },
  };
}

beforeEach(() => {
  runtimeQueryMock.mockReset();
  runtimeReadMock
    .mockReset()
    .mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
});

describe("published article prerender selection", () => {
  it.effect(
    "reads a real localized article through the native publication queries",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeArticleRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeReadMock.mockImplementation(createTestNativeQuery(context));

        expect(yield* readPublishedArticlePrerenderRoute("de")).toEqual({
          category: "politik",
          slug: "artikel-2",
        });
        expect(runtimeReadMock).toHaveBeenCalledTimes(2);
        expect(runtimeQueryMock).not.toHaveBeenCalled();
      })
  );

  it.effect("selects one tuple without continuing either inventory", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce(categoryPage())
        .mockResolvedValueOnce(articlePage());

      expect(yield* readPublishedArticlePrerenderRoute("en")).toEqual({
        category: testArticleProjection.categoryRouteSlug,
        slug: testArticleProjection.articleRouteSlug,
      });
      expect(runtimeQueryMock).toHaveBeenCalledTimes(2);
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
        appLocale: "en",
        expectedManifestHash: null,
        expectedReleaseId: null,
        paginationOpts: { cursor: null, numItems: PROJECTION_PAGE_LIMIT },
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
        appLocale: "en",
        category: testArticleProjection.category,
        expectedManifestHash: null,
        expectedReleaseId: null,
        paginationOpts: { cursor: null, numItems: PROJECTION_PAGE_LIMIT },
      });
    })
  );

  it.effect.each([
    [
      "empty categories",
      { ...categoryPage(), result: { ...categoryPage().result, page: [] } },
    ],
    ["stale categories", { ...categoryPage(), stale: true }],
    ["unmanaged categories", { ...categoryPage(), managed: false }],
    ["missing category release", { ...categoryPage(), activeReleaseId: null }],
  ])("rejects %s before reading articles", ([_label, page]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(page);

      expect(
        yield* readPublishedArticlePrerenderRoute("en").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
        publicPath: "articles",
      });
      expect(runtimeQueryMock).toHaveBeenCalledOnce();
    })
  );

  it.effect.each([
    [
      "empty articles",
      { ...articlePage(), result: { ...articlePage().result, page: [] } },
    ],
    ["stale articles", { ...articlePage(), stale: true }],
    ["changed release", { ...articlePage(), activeReleaseId: "release-new" }],
    [
      "changed manifest",
      { ...articlePage(), activeManifestHash: `sha256:${"c".repeat(64)}` },
    ],
    [
      "changed source revision",
      { ...articlePage(), sourceRevision: "c".repeat(40) },
    ],
  ])("rejects a seed from %s", ([_label, page]) =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockResolvedValueOnce(categoryPage())
        .mockResolvedValueOnce(page);

      expect(
        yield* readPublishedArticlePrerenderRoute("en").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
      });
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
