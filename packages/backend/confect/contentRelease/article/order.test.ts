import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { paginateArticles } from "@repo/backend/confect/contentRelease/article/order";
import {
  PROJECTION_PAGE_BYTES,
  PROJECTION_PAGE_LIMIT,
  PUBLICATION_SCAN_LIMIT,
} from "@repo/backend/confect/contentRelease/paging";
import { convexModules } from "@repo/backend/confect/test.setup";
import { articlePublicationCursor } from "@repo/backend/content/article/cursor";
import schema from "@repo/backend/convex/schema";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { ARTICLE_PUBLICATION_CURSOR_PREFIX } from "@repo/contents/publication";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { getDocumentSize } from "convex/values";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Schema } from "effect";

describe("contentRelease/article/order", () => {
  it("fails closed for an exhausted budget or an invalid stored numeric value", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const read = (maximumBytesRead: number) =>
      t.query((_ctx) =>
        Effect.runPromise(
          paginateArticles("blue", "en", "politics", {
            cursor: null,
            maximumBytesRead,
            maximumRowsRead: PUBLICATION_SCAN_LIMIT,
            numItems: 1,
          }).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, _ctx.db))
          )
        )
      );
    await expect(read(0)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_LIMIT",
    });
    await t.mutation(async (ctx) => {
      const row = await ctx.db.query("articleCatalog").unique();
      assert(row);
      await ctx.db.patch(row._id, {
        sequence: Number.NaN,
      });
    });
    await expect(read(PROJECTION_PAGE_BYTES)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it.effect(
    "rejects a portable position from another slot, locale, or category",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => insertRuntimeArticles(ctx, 1))
        );
        const row = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("articleCatalog").unique())
        );
        assert(row);
        const cursor = articlePublicationCursor(row);
        for (const [slot, locale, category] of [
          ["green", "en", "politics"],
          ["blue", "de", "politics"],
          ["blue", "en", "history"],
        ] as const) {
          yield* Effect.promise(() =>
            expect(
              t.query((_ctx) =>
                Effect.runPromiseWith(runtimeServices)(
                  paginateArticles(slot, locale, category, {
                    cursor,
                    maximumBytesRead: PROJECTION_PAGE_BYTES,
                    maximumRowsRead: PUBLICATION_SCAN_LIMIT,
                    numItems: 1,
                  }).pipe(
                    Effect.provide(
                      ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                    )
                  )
                )
              )
            ).rejects.toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            })
          );
        }
      })
  );
  it.effect(
    "keeps a byte-limited lookahead row available after a portable split",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => insertRuntimeArticles(ctx, 3))
        );
        const row = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db
              .query("articleCatalog")
              .withIndex(
                "by_slot_appLocale_category_datePublished_contentKey",
                (index) =>
                  index
                    .eq("slot", "blue")
                    .eq("appLocale", "en")
                    .eq("category", "politics")
              )
              .order("desc")
              .first()
          )
        );
        assert(row);
        const first = yield* Effect.promise(() =>
          t.query((_ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              paginateArticles("blue", "en", "politics", {
                cursor: null,
                maximumBytesRead: getDocumentSize(row) + 1,
                maximumRowsRead: PUBLICATION_SCAN_LIMIT,
                numItems: 1,
              }).pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                )
              )
            )
          )
        );
        expect(first).toMatchObject({
          isDone: false,
          pageStatus: "SplitRequired",
          splitCursor: articlePublicationCursor(row),
        });
        expect(Arr.map(first.page, (article) => article.contentKey)).toEqual([
          testArticleProjection(2).contentKey,
        ]);
        const next = yield* Effect.promise(() =>
          t.query((_ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              paginateArticles("blue", "en", "politics", {
                cursor: first.continueCursor,
                maximumBytesRead: PROJECTION_PAGE_BYTES,
                maximumRowsRead: PUBLICATION_SCAN_LIMIT,
                numItems: 2,
              }).pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                )
              )
            )
          )
        );
        expect(Arr.map(next.page, (article) => article.contentKey)).toEqual([
          testArticleProjection(1).contentKey,
          testArticleProjection(0).contentKey,
        ]);
        expect(next.isDone).toBe(true);
      })
  );
  it("accepts deployed seven-field positions and emits portable positions", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 3));
    const first = await target.query((ctx) =>
      ctx.db
        .query("articleCatalog")
        .withIndex(
          "by_slot_appLocale_category_datePublished_contentKey",
          (index) =>
            index
              .eq("slot", "blue")
              .eq("appLocale", "en")
              .eq("category", "politics")
        )
        .order("desc")
        .first()
    );
    if (!first) {
      throw new Error("Expected an article position fixture.");
    }
    const encodedPosition = encodeJsonText([
      first.slot,
      first.appLocale,
      first.category,
      first.datePublished,
      first.contentKey,
      first._creationTime,
      first._id,
    ]);
    const legacy = `${ARTICLE_PUBLICATION_CURSOR_PREFIX}${encodedPosition}`;
    const result = await target.query((_ctx) =>
      Effect.runPromise(
        paginateArticles("blue", "en", "politics", {
          cursor: legacy,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: 4,
          numItems: 1,
        }).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, _ctx.db))
        )
      )
    );
    expect(Arr.map(result.page, ({ contentKey }) => contentKey)).toEqual([
      testArticleProjection(1).contentKey,
    ]);
    const position: unknown = Schema.decodeSync(JsonTextSchema)(
      result.continueCursor.slice(ARTICLE_PUBLICATION_CURSOR_PREFIX.length)
    );
    expect(position).toHaveLength(5);
  });
  it("returns one full page without a false split boundary", async () => {
    const t = convexTest(schema, convexModules);
    const articleCount = PROJECTION_PAGE_LIMIT + 2;
    await t.mutation((ctx) =>
      insertRuntimeArticles(ctx, articleCount, (index) =>
        testArticleProjection(index, "2026-07-23")
      )
    );
    const first = await t.query(async (ctx) => {
      const result = await Effect.runPromise(
        paginateArticles("blue", "en", "politics", {
          cursor: null,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: PUBLICATION_SCAN_LIMIT,
          numItems: PROJECTION_PAGE_LIMIT,
        }).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return {
        metrics,
        result,
      };
    });
    expect(first.result.page).toHaveLength(PROJECTION_PAGE_LIMIT);
    expect(first.result.isDone).toBe(false);
    expect(first.result.pageStatus).toBeUndefined();
    expect(first.result.splitCursor).toBeUndefined();
    expect(
      first.result.continueCursor.startsWith(ARTICLE_PUBLICATION_CURSOR_PREFIX)
    ).toBe(true);
    expect(first.metrics.documentsRead.used).toBeLessThanOrEqual(
      PUBLICATION_SCAN_LIMIT
    );
    const second = await t.query(async (ctx) => {
      const result = await Effect.runPromise(
        paginateArticles("blue", "en", "politics", {
          cursor: first.result.continueCursor,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: PUBLICATION_SCAN_LIMIT,
          numItems: PROJECTION_PAGE_LIMIT,
        }).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return {
        metrics,
        result,
      };
    });
    expect(second.result.page).toHaveLength(2);
    expect(second.result.isDone).toBe(true);
    expect(second.result.pageStatus).toBeUndefined();
    expect(second.result.splitCursor).toBeUndefined();
    expect(second.metrics.documentsRead.used).toBeLessThanOrEqual(
      PUBLICATION_SCAN_LIMIT
    );
    const contentKeys = Arr.map(
      [...first.result.page, ...second.result.page],
      (article) => article.contentKey
    );
    expect(Arr.dedupe(contentKeys)).toHaveLength(articleCount);
  });
  it("bounds publication lookahead by physical rows and bytes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 3));
    const rowBound = await t.query(async (ctx) => {
      const result = await Effect.runPromise(
        paginateArticles("blue", "en", "politics", {
          cursor: null,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: 4,
          numItems: 1,
        }).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return {
        metrics,
        result,
      };
    });
    expect(rowBound.result.page).toMatchObject([
      {
        contentKey: testArticleProjection(2).contentKey,
      },
    ]);
    expect(
      rowBound.result.continueCursor.startsWith(
        ARTICLE_PUBLICATION_CURSOR_PREFIX
      )
    ).toBe(true);
    expect(rowBound.metrics.documentsRead.used).toBeLessThanOrEqual(4);
    const byteBound = await t.query(async (ctx) => {
      const result = await Effect.runPromise(
        paginateArticles("blue", "en", "politics", {
          cursor: null,
          maximumBytesRead: 1,
          maximumRowsRead: 4,
          numItems: 1,
        }).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return {
        metrics,
        result,
      };
    });
    expect(byteBound.result).toMatchObject({
      isDone: false,
      pageStatus: "SplitRequired",
      page: [
        {
          contentKey: testArticleProjection(2).contentKey,
        },
      ],
    });
    expect(
      byteBound.result.continueCursor.startsWith(
        ARTICLE_PUBLICATION_CURSOR_PREFIX
      )
    ).toBe(true);
    expect(
      byteBound.result.splitCursor?.startsWith(
        ARTICLE_PUBLICATION_CURSOR_PREFIX
      )
    ).toBe(true);
    expect(byteBound.metrics.bytesRead.used).toBeGreaterThan(1);
    expect(byteBound.metrics.databaseQueries.used).toBe(1);
    expect(byteBound.metrics.documentsRead.used).toBe(1);
  });
});
