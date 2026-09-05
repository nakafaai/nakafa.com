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
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { readArticleModel } from "@repo/backend/content/article/model";
import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const localizedRoutes = [
  { appLocale: "en", article: "article-route", category: "politics" },
  { appLocale: "id", article: "rute-artikel", category: "politik" },
  { appLocale: "de", article: "artikel-route", category: "politik" },
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
  return Schema.decodeUnknownSync(ArticleProjectionSchema)(JSON.parse(source));
}

describe("contentRelease/article/model", () => {
  it.effect(
    "rejects a published article whose active catalog row disappeared",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) => insertRuntimeArticles(ctx, 1))
        );
        yield* Effect.promise(() =>
          target.mutation(async (ctx) => {
            const row = await ctx.db.query("articleCatalog").unique();
            assert(row);
            await ctx.db.delete("articleCatalog", row._id);
          })
        );
        yield* Effect.promise(() =>
          expect(
            target.query(api.contentRelease.article.route, {
              appLocale: "en",
              publicPath: testArticleProjection(0).publicPath,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      })
  );

  it("fails closed before signed article publication", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readArticleModel("en", "articles/test/missing").pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });

  it("returns the route and every reciprocal locale counterpart", async () => {
    const target = convexTest(schema, convexModules);
    const requested = localizedArticle(0);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, localizedRoutes.length, localizedArticle)
    );

    const result = await target.query(api.contentRelease.article.route, {
      appLocale: requested.appLocale,
      publicPath: requested.publicPath,
    });

    expect(result).toMatchObject({
      activeAppLocales: ["en", "id", "de"],
      activeReleaseId: expect.any(String),
    });
    expect(decodeProjection(result.projectionJson ?? "")).toEqual(requested);
    expect(result.alternateJson.map(decodeProjection)).toMatchObject([
      { appLocale: "en", publicPath: localizedArticle(0).publicPath },
      { appLocale: "id", publicPath: localizedArticle(1).publicPath },
      { appLocale: "de", publicPath: localizedArticle(2).publicPath },
    ]);
  });

  it("returns a missing route inside the current signed family", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, localizedRoutes.length, localizedArticle)
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readArticleModel("en", "articles/politics/missing").pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      alternateJson: [],
      projectionJson: null,
    });
  });

  it("rejects an article whose locale counterpart is missing", async () => {
    const target = convexTest(schema, convexModules);
    const projection = localizedArticle(0);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, 1, localizedArticle)
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readArticleModel(projection.appLocale, projection.publicPath).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects stale catalog metadata and an unexpected release", async () => {
    const target = convexTest(schema, convexModules);
    const requested = localizedArticle(0);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, localizedRoutes.length, localizedArticle)
    );
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readArticleModel(
            requested.appLocale,
            requested.publicPath,
            "release-unexpected"
          ).pipe(Effect.provide(convexArticleLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await target.mutation(async (ctx) => {
      const row = await ctx.db
        .query("articleCatalog")
        .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
          index
            .eq("slot", "blue")
            .eq("appLocale", requested.appLocale)
            .eq("publicPath", requested.publicPath)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one current article row.");
      }
      await ctx.db.patch("articleCatalog", row._id, {
        datePublished: "2020-01-01",
      });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readArticleModel(requested.appLocale, requested.publicPath).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
