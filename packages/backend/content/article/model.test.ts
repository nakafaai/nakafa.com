import { assert, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { PublicContentRuntimeFoundSchema } from "@nakafa/aksara-contracts/runtime/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { articleLayer } from "@repo/backend/content/article/confect";
import { readArticleModel } from "@repo/backend/content/article/model";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { Array as Arr, Effect, Schema } from "effect";

const localizedRoutes = [
  {
    appLocale: "en",
    article: "article-route",
    category: "politics",
  },
  {
    appLocale: "id",
    article: "rute-artikel",
    category: "politik",
  },
  {
    appLocale: "de",
    article: "artikel-route",
    category: "politik",
  },
] as const;

/** Builds one locale-owned route for a shared source article identity. */
function localizedArticle(index: number) {
  const source = testArticleProjection(0);
  const route = localizedRoutes[index];
  if (!route) {
    throw new Error("Expected one localized article test route.");
  }
  const appLocale = AppLocaleSchema.make(route.appLocale);
  const articleRouteSlug = ArticleRouteSlugSchema.make(route.article);
  const categoryRouteSlug = ArticleRouteSlugSchema.make(route.category);
  return ArticleProjectionSchema.make({
    ...source,
    appLocale,
    articleRouteSlug,
    artifactLocale: ArtifactLocaleSchema.make(route.appLocale),
    categoryRouteSlug,
    graph: {
      ...source.graph,
      assetId: `asset:${appLocale}:article:${source.category}:article:${source.category}:${source.articleSlug}`,
    },
    parentPath: PublicPathSchema.make(`articles/${categoryRouteSlug}`),
    publicPath: PublicPathSchema.make(
      `articles/${categoryRouteSlug}/${articleRouteSlug}`
    ),
  });
}

/** Decodes one backend-returned projection for result assertions. */
function decodeProjection(source: string) {
  return Schema.decodeSync(Schema.fromJsonString(ArticleProjectionSchema))(
    source
  );
}
describe("contentRelease/article/model", () => {
  it.effect(
    "delivers one bounded coherent article shell and body through a single query",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              insertRuntimeArticles(
                targetCtx,
                localizedRoutes.length,
                localizedArticle
              )
            );
            const result = yield* (yield* QueryRunner).runQuery(
              refs.public.contentRelease.article.delivery,
              {
                appLocale: "en",
                publicPath: localizedArticle(0).publicPath,
              }
            );
            const runtime = yield* Schema.decodeEffect(
              Schema.fromJsonString(PublicContentRuntimeFoundSchema)
            )(result.runtimeJson ?? "", { onExcessProperty: "error" });
            expect(runtime.activeReleaseId).toBe(result.model.activeReleaseId);
            const projection = yield* Schema.decodeEffect(
              Schema.fromJsonString(ArticleProjectionSchema)
            )(result.model.projectionJson ?? "", { onExcessProperty: "error" });
            expect(runtime.projection).toEqual(projection);
            expect(runtime.delivery).toBe("public");
            const missing = yield* (yield* QueryRunner).runQuery(
              refs.public.contentRelease.article.delivery,
              {
                appLocale: "en",
                publicPath: "articles/missing",
              }
            );
            expect(missing.model.projectionJson).toBeNull();
            expect(missing.runtimeJson).toBeNull();
          })
        );
      })
  );
  it.effect(
    "rejects a published article whose active catalog row disappeared",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            yield* Effect.promise(() => insertRuntimeArticles(targetCtx, 1));
            const row = yield* Effect.promise(() =>
              targetCtx.db.query("articleCatalog").unique()
            );
            assert(row);
            yield* Effect.promise(() =>
              targetCtx.db.delete("articleCatalog", row._id)
            );
            expect(
              yield* (yield* QueryRunner)
                .runQuery(refs.public.contentRelease.article.route, {
                  appLocale: "en",
                  publicPath: testArticleProjection(0).publicPath,
                })
                .pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect("fails closed before signed article publication", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          expect(
            yield* readArticleModel("en", "articles/test/missing").pipe(
              Effect.provide(articleLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_MISSING",
          });
        })
      );
    })
  );
  it.effect("returns the route and every reciprocal locale counterpart", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          const requested = localizedArticle(0);
          yield* Effect.promise(() =>
            insertRuntimeArticles(
              targetCtx,
              localizedRoutes.length,
              localizedArticle
            )
          );
          const result = yield* (yield* QueryRunner).runQuery(
            refs.public.contentRelease.article.route,
            {
              appLocale: requested.appLocale,
              publicPath: requested.publicPath,
            }
          );
          expect(result).toMatchObject({
            activeAppLocales: ["en", "id", "de"],
            activeReleaseId: expect.any(String),
          });
          expect(decodeProjection(result.projectionJson ?? "")).toEqual(
            requested
          );
          expect(Arr.map(result.alternateJson, decodeProjection)).toMatchObject(
            [
              {
                appLocale: "en",
                publicPath: localizedArticle(0).publicPath,
              },
              {
                appLocale: "id",
                publicPath: localizedArticle(1).publicPath,
              },
              {
                appLocale: "de",
                publicPath: localizedArticle(2).publicPath,
              },
            ]
          );
        })
      );
    })
  );
  it.effect("returns a missing route inside the current signed family", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            insertRuntimeArticles(
              targetCtx,
              localizedRoutes.length,
              localizedArticle
            )
          );
          expect(
            yield* readArticleModel("en", "articles/politics/missing").pipe(
              Effect.provide(articleLayer)
            )
          ).toMatchObject({
            alternateJson: [],
            projectionJson: null,
          });
        })
      );
    })
  );
  it.effect("rejects an article whose locale counterpart is missing", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          const projection = localizedArticle(0);
          yield* Effect.promise(() =>
            insertRuntimeArticles(targetCtx, 1, localizedArticle)
          );
          expect(
            yield* readArticleModel(
              projection.appLocale,
              projection.publicPath
            ).pipe(Effect.provide(articleLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect("rejects stale catalog metadata and an unexpected release", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          const requested = localizedArticle(0);
          yield* Effect.promise(() =>
            insertRuntimeArticles(
              targetCtx,
              localizedRoutes.length,
              localizedArticle
            )
          );
          expect(
            yield* readArticleModel(
              requested.appLocale,
              requested.publicPath,
              "release-unexpected"
            ).pipe(Effect.provide(articleLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
          });
          const row = yield* Effect.promise(() =>
            targetCtx.db
              .query("articleCatalog")
              .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
                index
                  .eq("slot", "blue")
                  .eq("appLocale", requested.appLocale)
                  .eq("publicPath", requested.publicPath)
              )
              .unique()
          );
          if (!row) {
            throw new Error("Expected one current article row.");
          }
          yield* Effect.promise(() =>
            targetCtx.db.patch("articleCatalog", row._id, {
              datePublished: "2020-01-01",
            })
          );
          expect(
            yield* readArticleModel(
              requested.appLocale,
              requested.publicPath
            ).pipe(Effect.provide(articleLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
