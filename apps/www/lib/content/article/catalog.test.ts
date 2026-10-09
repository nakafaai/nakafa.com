import { HttpClient } from "@confect/js";
// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  ArticleProjectionSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/paging";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Effect, Layer } from "effect";
import {
  getPublishedArticlePage,
  getPublishedCategories,
  readPublishedArticlePage,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import {
  activeReleaseId,
  articlePage,
  articleRow,
  categoryPage,
  makeArticleRuntimeSource,
  revision,
} from "@/test/content/article";
import {
  makeTestArticleProjection,
  testArticleProjection,
} from "@/test/content-article";

const cacheMock = vi.hoisted(() => vi.fn());
const runtimeQueryMock = vi.hoisted(() => vi.fn());
const initialCursor = {
  cursor: null,
  expectedManifestHash: null,
  expectedReleaseId: null,
  locale: "en" as const,
};
const staleManifestHash = Sha256HashSchema.make(`sha256:${"c".repeat(64)}`);
const staleReleaseId = ReleaseIdSchema.make("release-old");
vi.mock("@/lib/content/cache", () => ({
  applyContentCache: cacheMock,
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
describe("published article catalog", () => {
  it.effect("reads localized signed articles and categories", () =>
    Effect.gen(function* () {
      const fixture = yield* makeArticleRuntimeSource();
      const context = yield* createTestPublication(fixture.source);
      runtimeQueryMock.mockImplementation(context.query);
      const cursor = {
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "de" as const,
      };
      const page = yield* readPublishedArticlePage({
        ...cursor,
        category: ArticleCategorySchema.make("politics"),
      });
      expect(page).toMatchObject({
        activeReleaseId: fixture.state.activeReleaseId,
        done: true,
        articles: [
          {
            publicPath: "articles/politik/artikel-2",
          },
          {
            publicPath: "articles/politik/artikel-1",
          },
        ],
      });
      expect(yield* readPublishedCategories(cursor)).toMatchObject({
        activeReleaseId: fixture.state.activeReleaseId,
        done: true,
        categories: [
          {
            category: "politics",
            route: "politik",
            title: "Politik",
          },
        ],
      });
    })
  );
  beforeEach(() => {
    cacheMock.mockReset();
    runtimeQueryMock.mockReset();
  });
  it.effect(
    "decodes newest articles and preserves release-bound pagination",
    () =>
      Effect.gen(function* () {
        const older = makeTestArticleProjection("older-politics", "2023-01-01");
        const metadata = testArticleProjection.metadata;
        const updated = ArticleProjectionSchema.make({
          ...testArticleProjection,
          metadata: {
            ...metadata,
            dateModified: "2026-08-22",
          },
        });
        runtimeQueryMock.mockReturnValueOnce(
          Effect.succeed(
            articlePage({
              isDone: false,
              page: [articleRow(updated), articleRow(older)],
              sourceRevision: null,
            })
          )
        );
        const page = yield* Effect.promise(() =>
          getPublishedArticlePage({
            category: testArticleProjection.category,
            ...initialCursor,
          })
        );
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
          paginationOpts: {
            cursor: null,
            numItems: PROJECTION_PAGE_LIMIT,
          },
        });
        expect(cacheMock).toHaveBeenCalledWith("article");
      })
  );
  it.effect("decodes source-owned category titles without UI fallbacks", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(categoryPage()));
      const page = yield* Effect.promise(() =>
        getPublishedCategories({
          ...initialCursor,
        })
      );
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
    })
  );
  it.effect(
    "preserves optional descriptions and both terminal cursor states",
    () =>
      Effect.gen(function* () {
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
          .mockReturnValueOnce(
            Effect.succeed(
              articlePage({
                page: [articleRow(projection)],
              })
            )
          )
          .mockReturnValueOnce(
            Effect.succeed(
              categoryPage({
                isDone: false,
              })
            )
          );
        const articleResult = yield* readPublishedArticlePage({
          category: projection.category,
          ...initialCursor,
        });
        const categoryResult = yield* readPublishedCategories({
          ...initialCursor,
        });
        expect(articleResult.nextCursor).toBeNull();
        expect(articleResult.articles[0]).not.toHaveProperty("description");
        expect(categoryResult.nextCursor).toBe("next");
      })
  );
  it.effect(
    "preserves a stale cursor response for the route redirect boundary",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock
          .mockReturnValueOnce(
            Effect.succeed(
              articlePage({
                page: [],
                stale: true,
              })
            )
          )
          .mockReturnValueOnce(
            Effect.succeed(
              categoryPage({
                stale: true,
              })
            )
          );
        const [articles, categories] = yield* Effect.all([
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
        ]);
        expect(articles.stale).toBe(true);
        expect(categories.stale).toBe(true);
      })
  );
  it.effect("rejects invalid article rows", () =>
    Effect.gen(function* () {
      for (const [_name, row] of [
        [
          "invalid JSON",
          {
            ...articleRow(),
            projectionJson: "{",
          },
        ],
        [
          "invalid projection",
          {
            ...articleRow(),
            projectionJson: "{}",
          },
        ],
        [
          "foreign family",
          {
            ...articleRow(),
            family: "material",
          },
        ],
        [
          "foreign app locale",
          {
            ...articleRow(),
            appLocale: "id",
          },
        ],
        [
          "foreign key",
          {
            ...articleRow(),
            contentKey: "articles/other",
          },
        ],
        [
          "foreign route",
          {
            ...articleRow(),
            publicPath: "articles/other",
          },
        ],
      ] as const) {
        runtimeQueryMock.mockReturnValueOnce(
          Effect.succeed(
            articlePage({
              page: [row],
            })
          )
        );
        expect(
          yield* readPublishedArticlePage({
            category: testArticleProjection.category,
            ...initialCursor,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      }
    })
  );
  it.effect("rejects invalid category rows", () =>
    Effect.gen(function* () {
      for (const [_name, response] of [
        [
          "invalid category",
          categoryPage({
            category: "Politics",
          }),
        ],
        [
          "empty title",
          categoryPage({
            title: "",
          }),
        ],
        [
          "invalid source revision",
          {
            ...categoryPage(),
            sourceRevision: "main",
          },
        ],
      ] as const) {
        runtimeQueryMock.mockReturnValueOnce(Effect.succeed(response));
        expect(
          yield* readPublishedCategories({
            ...initialCursor,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      }
    })
  );
  it.effect(
    "rejects continuation pages without a complete release identity",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock
          .mockReturnValueOnce(
            Effect.succeed({
              ...articlePage({
                isDone: false,
              }),
              activeManifestHash: null,
            })
          )
          .mockReturnValueOnce(
            Effect.succeed({
              ...categoryPage({
                isDone: false,
              }),
              activeReleaseId: null,
            })
          );
        expect(
          yield* readPublishedArticlePage({
            category: testArticleProjection.category,
            ...initialCursor,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(
          yield* readPublishedCategories({
            ...initialCursor,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      })
  );
  it.effect("rejects a malformed active generation identity", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          ...articlePage(),
          activeManifestHash: "sha256:invalid",
        })
      );
      expect(
        yield* readPublishedArticlePage({
          category: testArticleProjection.category,
          ...initialCursor,
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
      });
    })
  );
  it.effect("rejects unmanaged article and category catalogs", () =>
    Effect.gen(function* () {
      runtimeQueryMock
        .mockReturnValueOnce(
          Effect.succeed({
            ...articlePage({
              page: [],
            }),
            activeManifestHash: null,
            activeReleaseId: null,
            managed: false,
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            ...categoryPage(),
            activeManifestHash: null,
            activeReleaseId: null,
            managed: false,
          })
        );
      expect(
        yield* readPublishedArticlePage({
          category: testArticleProjection.category,
          ...initialCursor,
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
      });
      expect(
        yield* readPublishedCategories({
          ...initialCursor,
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
      });
    })
  );
  it.effect("preserves typed query failures", () =>
    Effect.gen(function* () {
      const failure = new Error("catalog unavailable");
      runtimeQueryMock.mockReturnValueOnce(
        Effect.fail(
          new HttpClient.HttpClientError({
            cause: failure,
          })
        )
      );
      const error = yield* readPublishedCategories({
        ...initialCursor,
      }).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "HttpClientError",
        cause: failure,
      });
    })
  );
});
