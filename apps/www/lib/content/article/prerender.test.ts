import type { Ref } from "@confect/core";
// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/paging";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Array as Arr, Effect, Layer } from "effect";
import { readPublishedArticlePrerenderRoute } from "@/lib/content/article/prerender";
import { makeArticleRuntimeSource } from "@/test/content/article";
import {
  makeTestArticleProjection,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const generation = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "release-article",
  managed: true,
  sourceRevision: GitCommitShaSchema.make("a".repeat(40)),
  stale: false,
};
type ArticleRow = Ref.Returns<
  typeof contentRelease.article.publications
>["result"]["page"][number];
vi.mock("@/lib/content/cache", () => ({
  applyContentCache: vi.fn(),
}));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

/** Provides a category page with more inventory beyond its first bounded read. */
function categoryPage(): Ref.Returns<typeof contentRelease.article.categories> {
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
function articlePage(): Ref.Returns<
  typeof contentRelease.article.publications
> {
  return {
    ...generation,
    result: {
      continueCursor: "more-articles",
      isDone: false,
      page: Arr.map(
        [
          testArticleProjection,
          makeTestArticleProjection("older", "2023-01-01"),
        ],
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
});
describe("published article prerender selection", () => {
  it.effect(
    "reads a real localized article through the native publication queries",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeArticleRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(context.query);
        expect(yield* readPublishedArticlePrerenderRoute("de")).toEqual({
          category: "politik",
          slug: "artikel-2",
        });
        expect(runtimeQueryMock).toHaveBeenCalledTimes(2);
      })
  );
  it.effect("selects one tuple without continuing either inventory", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockReturnValueOnce(Effect.succeed(categoryPage()))
        .mockReturnValueOnce(Effect.succeed(articlePage()));
      expect(yield* readPublishedArticlePrerenderRoute("en")).toEqual({
        category: testArticleProjection.categoryRouteSlug,
        slug: testArticleProjection.articleRouteSlug,
      });
      expect(runtimeQueryMock).toHaveBeenCalledTimes(2);
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
        appLocale: "en",
        expectedManifestHash: null,
        expectedReleaseId: null,
        paginationOpts: {
          cursor: null,
          numItems: PROJECTION_PAGE_LIMIT,
        },
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
        appLocale: "en",
        category: testArticleProjection.category,
        expectedManifestHash: null,
        expectedReleaseId: null,
        paginationOpts: {
          cursor: null,
          numItems: PROJECTION_PAGE_LIMIT,
        },
      });
    })
  );
  it.effect.each([
    [
      "empty categories",
      {
        ...categoryPage(),
        result: {
          ...categoryPage().result,
          page: [],
        },
      },
    ],
    [
      "stale categories",
      {
        ...categoryPage(),
        stale: true,
      },
    ],
    [
      "unmanaged categories",
      {
        ...categoryPage(),
        managed: false,
      },
    ],
    [
      "missing category release",
      {
        ...categoryPage(),
        activeReleaseId: null,
      },
    ],
  ])("rejects %s before reading articles", ([_label, page]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(page));
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
      {
        ...articlePage(),
        result: {
          ...articlePage().result,
          page: [],
        },
      },
    ],
    [
      "stale articles",
      {
        ...articlePage(),
        stale: true,
      },
    ],
    [
      "changed release",
      {
        ...articlePage(),
        activeReleaseId: "release-new",
      },
    ],
    [
      "changed manifest",
      {
        ...articlePage(),
        activeManifestHash: `sha256:${"c".repeat(64)}`,
      },
    ],
    [
      "changed source revision",
      {
        ...articlePage(),
        sourceRevision: "c".repeat(40),
      },
    ],
  ])("rejects a seed from %s", ([_label, page]) =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockReturnValueOnce(Effect.succeed(categoryPage()))
        .mockReturnValueOnce(Effect.succeed(page));
      expect(
        yield* readPublishedArticlePrerenderRoute("en").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
      });
    })
  );
});
