import { describe, expect, it } from "@effect/vitest";
import { paginateArticles } from "@repo/backend/convex/contentRelease/article/order";
import {
  PROJECTION_PAGE_BYTES,
  PROJECTION_PAGE_LIMIT,
  PUBLICATION_SCAN_LIMIT,
} from "@repo/backend/convex/contentRelease/paging";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { ARTICLE_PUBLICATION_CURSOR_PREFIX } from "@repo/contents/_types/publication";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/article/order", () => {
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
      const result = await Effect.runPromise(
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
      const result = await Effect.runPromise(
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
      const result = await Effect.runPromise(
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
