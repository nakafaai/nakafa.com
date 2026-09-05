import { assert, describe, expect, it } from "@effect/vitest";
import { articlePublicationCursor } from "@repo/backend/content/article/cursor";
import { paginateArticles } from "@repo/backend/convex/contentRelease/article/order";
import {
  PROJECTION_PAGE_BYTES,
  PROJECTION_PAGE_LIMIT,
  PUBLICATION_SCAN_LIMIT,
} from "@repo/backend/convex/contentRelease/paging";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { ARTICLE_PUBLICATION_CURSOR_PREFIX } from "@repo/contents/_types/publication";
import { getDocumentSize } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/article/order", () => {
  it.effect(
    "rejects a portable position from another slot, locale, or category",
    () =>
      Effect.gen(function* () {
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
              t.query((ctx) =>
                runConvexProgram(
                  paginateArticles(ctx, slot, locale, category, {
                    cursor,
                    maximumBytesRead: PROJECTION_PAGE_BYTES,
                    maximumRowsRead: PUBLICATION_SCAN_LIMIT,
                    numItems: 1,
                  })
                )
              )
            ).rejects.toMatchObject({
              data: { code: "CONTENT_RELEASE_INTEGRITY" },
            })
          );
        }
      })
  );

  it.effect(
    "keeps a byte-limited lookahead row available after a portable split",
    () =>
      Effect.gen(function* () {
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
          t.query((ctx) =>
            runConvexProgram(
              paginateArticles(ctx, "blue", "en", "politics", {
                cursor: null,
                maximumBytesRead: getDocumentSize(row) + 1,
                maximumRowsRead: PUBLICATION_SCAN_LIMIT,
                numItems: 1,
              })
            )
          )
        );
        expect(first).toMatchObject({
          isDone: false,
          pageStatus: "SplitRequired",
          splitCursor: articlePublicationCursor(row),
        });
        expect(first.page.map((article) => article.contentKey)).toEqual([
          testArticleProjection(2).contentKey,
        ]);
        const next = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              paginateArticles(ctx, "blue", "en", "politics", {
                cursor: first.continueCursor,
                maximumBytesRead: PROJECTION_PAGE_BYTES,
                maximumRowsRead: PUBLICATION_SCAN_LIMIT,
                numItems: 2,
              })
            )
          )
        );
        expect(next.page.map((article) => article.contentKey)).toEqual([
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
    const legacy = `${ARTICLE_PUBLICATION_CURSOR_PREFIX}${JSON.stringify([first.slot, first.appLocale, first.category, first.datePublished, first.contentKey, first._creationTime, first._id])}`;
    const result = await target.query((ctx) =>
      runConvexProgram(
        paginateArticles(ctx, "blue", "en", "politics", {
          cursor: legacy,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: 4,
          numItems: 1,
        })
      )
    );
    expect(result.page.map(({ contentKey }) => contentKey)).toEqual([
      testArticleProjection(1).contentKey,
    ]);
    const position: unknown = JSON.parse(
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
      const result = await runConvexProgram(
        paginateArticles(ctx, "blue", "en", "politics", {
          cursor: null,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: PUBLICATION_SCAN_LIMIT,
          numItems: PROJECTION_PAGE_LIMIT,
        })
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return { metrics, result };
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
      const result = await runConvexProgram(
        paginateArticles(ctx, "blue", "en", "politics", {
          cursor: first.result.continueCursor,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: PUBLICATION_SCAN_LIMIT,
          numItems: PROJECTION_PAGE_LIMIT,
        })
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return { metrics, result };
    });

    expect(second.result.page).toHaveLength(2);
    expect(second.result.isDone).toBe(true);
    expect(second.result.pageStatus).toBeUndefined();
    expect(second.result.splitCursor).toBeUndefined();
    expect(second.metrics.documentsRead.used).toBeLessThanOrEqual(
      PUBLICATION_SCAN_LIMIT
    );
    const contentKeys = [...first.result.page, ...second.result.page].map(
      (article) => article.contentKey
    );
    expect(new Set(contentKeys)).toHaveProperty("size", articleCount);
  });

  it("bounds publication lookahead by physical rows and bytes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 3));

    const rowBound = await t.query(async (ctx) => {
      const result = await runConvexProgram(
        paginateArticles(ctx, "blue", "en", "politics", {
          cursor: null,
          maximumBytesRead: PROJECTION_PAGE_BYTES,
          maximumRowsRead: 4,
          numItems: 1,
        })
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return { metrics, result };
    });
    expect(rowBound.result.page).toMatchObject([
      { contentKey: testArticleProjection(2).contentKey },
    ]);
    expect(
      rowBound.result.continueCursor.startsWith(
        ARTICLE_PUBLICATION_CURSOR_PREFIX
      )
    ).toBe(true);
    expect(rowBound.metrics.documentsRead.used).toBeLessThanOrEqual(4);

    const byteBound = await t.query(async (ctx) => {
      const result = await runConvexProgram(
        paginateArticles(ctx, "blue", "en", "politics", {
          cursor: null,
          maximumBytesRead: 1,
          maximumRowsRead: 4,
          numItems: 1,
        })
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return { metrics, result };
    });
    expect(byteBound.result).toMatchObject({
      isDone: false,
      pageStatus: "SplitRequired",
      page: [{ contentKey: testArticleProjection(2).contentKey }],
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
