import { describe, expect, it } from "@effect/vitest";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import {
  readArticleBucket,
  readCategoryArticles,
  readLatestArticles,
} from "@repo/backend/content/article/discovery";
import { readArticleModel } from "@repo/backend/content/article/model";
import {
  readArticlePage,
  readCategoryPage,
} from "@repo/backend/content/article/read";
import { resolveArticleRoute } from "@repo/backend/content/article/route";
import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/content/article/sitemap";
import { snapshotArticleLayer } from "@repo/backend/content/article/snapshot";
import { ArticleSource } from "@repo/backend/content/article/source";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { encodePageCursor } from "@repo/backend/convex/contentRelease/cursor";
import { validatePublicationPage } from "@repo/backend/convex/contentRelease/paging";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { categorizedArticle } from "@repo/backend/test/article/release";
import {
  insertRuntimeArticles,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { convexTest } from "convex-test";
import { Effect, Layer, Option, Struct } from "effect";

/** Captures stored fixture rows without database-generated identities. */
async function articleSnapshot(ctx: QueryCtx) {
  return {
    contentKeys: [],
    contentState: (await ctx.db.query("contentState").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentReleases: (await ctx.db.query("contentReleases").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentHeads: (await ctx.db.query("contentHeads").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentBindings: (await ctx.db.query("contentBindings").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentArtifacts: (await ctx.db.query("contentArtifacts").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentSnapshots: (await ctx.db.query("contentSnapshots").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    articleCatalog: (await ctx.db.query("articleCatalog").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    articleCategories: (await ctx.db.query("articleCategories").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    articleBuckets: (await ctx.db.query("articleBuckets").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
  };
}
describe("portable article reads", () => {
  it.effect(
    "returns bounded empty results and rejects malformed or foreign page positions",
    () =>
      Effect.gen(function* () {
        const tables = yield* projectActiveRuntime(makeRuntimeSource().source);
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotArticleLayer(tables)
        );
        yield* Effect.gen(function* () {
          const source = yield* ArticleSource;
          const options = yield* validatePublicationPage({
            cursor: null,
            numItems: 1,
          });
          expect(
            Option.isNone(yield* source.article("blue", "missing", "en"))
          ).toBe(true);
          expect(
            yield* source.byPublicPath("blue", "en", "articles/missing")
          ).toEqual([]);
          expect(yield* source.byAssetId("blue", "en", "missing")).toEqual([]);
          expect(yield* source.ordered("blue", "en", null, 1)).toEqual([]);
          expect(yield* source.ordered("blue", "en", "politics", 1)).toEqual(
            []
          );
          expect(
            yield* source.publications("blue", "en", "politics", options)
          ).toEqual({ page: [], isDone: true, continueCursor: "" });
          expect(yield* source.categories("blue", "en", options)).toEqual({
            page: [],
            isDone: true,
            continueCursor: "",
          });
          const partition = yield* source.partition("blue", "en", "00", 1);
          expect(Option.isNone(partition.count)).toBe(true);
          expect(partition.articles).toEqual([]);
          expect(partition.categories).toEqual([]);
          expect(yield* source.buckets("blue", "en", 1)).toEqual([]);
          const last =
            'article-publication|["blue","en","politics","2026-01-01","article/politics/last"]';
          expect(
            yield* source.publications("blue", "en", "politics", {
              ...options,
              cursor: last,
            })
          ).toEqual({ page: [], isDone: true, continueCursor: last });
          for (const cursor of [
            "foreign|[]",
            "article-publication|{",
            "article-publication|[]",
            'article-publication|["green","en","politics","2026-01-01","article/politics/last"]',
            'article-publication|["blue","de","politics","2026-01-01","article/politics/last"]',
            'article-publication|["blue","en","science","2026-01-01","article/politics/last"]',
          ]) {
            expect(
              yield* source
                .publications("blue", "en", "politics", { ...options, cursor })
                .pipe(Effect.flip)
            ).toMatchObject({
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }
          const category = 'article-category|["blue","en","politics"]';
          expect(
            yield* source.categories("blue", "en", {
              ...options,
              cursor: category,
            })
          ).toEqual({ page: [], isDone: true, continueCursor: category });
          for (const cursor of [
            "foreign|[]",
            "article-category|{",
            "article-category|[]",
            'article-category|["green","en","politics"]',
            'article-category|["blue","de","politics"]',
          ]) {
            expect(
              yield* source
                .categories("blue", "en", { ...options, cursor })
                .pipe(Effect.flip)
            ).toMatchObject({
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }
        }).pipe(Effect.provide(layer));
      })
  );
  it.effect(
    "matches localized routes, references, publication order, and complete sitemap partitions",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const locales = ["en", "id", "de"] as const;
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            insertRuntimeArticles(ctx, 6, (index) => {
              const locale = locales[index % locales.length];
              if (!locale) {
                throw new Error("Expected one fixture locale.");
              }
              return testLocalizedArticleProjection(
                Math.floor(index / locales.length),
                locale
              );
            })
          )
        );
        const tables = yield* Effect.promise(() =>
          target.query(articleSnapshot)
        );
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotArticleLayer(tables)
        );
        expect(
          Object.values(tables)
            .flat()
            .some((row) => "_id" in row || "_creationTime" in row)
        ).toBe(false);
        for (const appLocale of locales) {
          const requested = testLocalizedArticleProjection(0, appLocale);
          const program = Effect.gen(function* () {
            const source = yield* ArticleSource;
            const result = yield* Effect.all({
              found: readArticleModel(appLocale, requested.publicPath),
              missing: readArticleModel(appLocale, "articles/politics/missing"),
              latest: readLatestArticles(appLocale, 2),
              category: readCategoryArticles(appLocale, "politics", 1),
              buckets: readArticleBuckets(appLocale),
              routeReference: source
                .byPublicPath("blue", appLocale, requested.publicPath)
                .pipe(
                  Effect.map((rows) => rows.map(({ contentKey }) => contentKey))
                ),
              assetReference: source
                .byAssetId("blue", appLocale, requested.graph.assetId)
                .pipe(
                  Effect.map((rows) => rows.map(({ contentKey }) => contentKey))
                ),
            });
            const partitions = yield* Effect.forEach(
              result.buckets.buckets,
              (bucket) =>
                Effect.all({
                  sitemap: readArticleSitemap(appLocale, bucket),
                  discovery: readArticleBucket(appLocale, bucket),
                })
            );
            return { result, partitions };
          });
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                program.pipe(Effect.provide(convexArticleLayer(ctx)))
              )
            )
          );
          const portable = yield* program.pipe(Effect.provide(layer));
          expect(portable).toEqual(native);
        }
      })
  );
  it.effect(
    "continues a snapshot publication cursor through the live ordered index without duplication",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) => insertRuntimeArticles(ctx, 3))
        );
        const tables = yield* Effect.promise(() =>
          target.query(articleSnapshot)
        );
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotArticleLayer(tables)
        );
        const first = yield* readArticlePage("politics", "en", null, null, {
          cursor: null,
          numItems: 1,
        }).pipe(Effect.provide(layer));
        const payload: unknown = JSON.parse(
          first.result.continueCursor.slice("article-publication|".length)
        );
        expect(payload).toHaveLength(5);
        const next = readArticlePage(
          "politics",
          "en",
          first.activeManifestHash,
          first.activeReleaseId,
          { cursor: first.result.continueCursor, numItems: 2 }
        );
        const native = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(next.pipe(Effect.provide(convexArticleLayer(ctx))))
          )
        );
        const portable = yield* next.pipe(Effect.provide(layer));
        expect(native.result.page).toEqual(portable.result.page);
        expect(native.result.isDone).toBe(true);
        expect(
          new Set(
            [...first.result.page, ...native.result.page].map(
              ({ contentKey }) => contentKey
            )
          ).size
        ).toBe(3);
      })
  );
  it.effect(
    "continues portable and deployed native category cursors with the same exact next category",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            insertRuntimeArticles(ctx, 3, (index) =>
              categorizedArticle({
                article: index,
                category: `category-${index}`,
                route: `category-${index}`,
                title: `Category ${index}`,
              })
            )
          )
        );
        const tables = yield* Effect.promise(() =>
          target.query(articleSnapshot)
        );
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotArticleLayer(tables)
        );
        const first = yield* readCategoryPage("en", null, null, {
          cursor: null,
          numItems: 1,
        }).pipe(Effect.provide(layer));
        const legacy = yield* Effect.promise(() =>
          target.query((ctx) =>
            ctx.db
              .query("articleCategories")
              .withIndex("by_slot_and_appLocale_and_category", (index) =>
                index.eq("slot", "blue").eq("appLocale", "en")
              )
              .paginate({ cursor: null, numItems: 1 })
          )
        );
        const next = (cursor: string) =>
          readCategoryPage(
            "en",
            first.activeManifestHash,
            first.activeReleaseId,
            {
              cursor,
              numItems: 2,
            }
          );
        const portable = yield* next(first.result.continueCursor).pipe(
          Effect.provide(layer)
        );
        for (const cursor of [
          first.result.continueCursor,
          encodePageCursor("category", "blue", legacy.continueCursor),
        ]) {
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                next(cursor).pipe(Effect.provide(convexArticleLayer(ctx)))
              )
            )
          );
          expect(native.result.page).toEqual(portable.result.page);
          expect(native.result.isDone).toBe(true);
        }
      })
  );
  it.effect(
    "fails with a typed identity error for duplicate portable articles and corrupted provenance",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) => insertRuntimeArticles(ctx, 1))
        );
        const tables = yield* Effect.promise(() =>
          target.query(articleSnapshot)
        );
        const row = tables.articleCatalog[0];
        if (!row) {
          throw new Error("Expected one article fixture.");
        }
        for (const articleCatalog of [
          [row, row],
          [{ ...row, projectionHash: "sha256:corrupted" }],
        ]) {
          const failure = yield* resolveArticleRoute("en", row.publicPath).pipe(
            Effect.provide(
              Layer.merge(
                snapshotPublicationLayer(tables),
                snapshotArticleLayer({ ...tables, articleCatalog })
              )
            ),
            Effect.flip
          );
          expect(failure).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );
});
