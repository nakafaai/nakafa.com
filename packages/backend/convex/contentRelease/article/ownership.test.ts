import { describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadPredecessorRoutes,
  stageCategory,
  validateCategoryClaim,
} from "@repo/backend/convex/contentRelease/article/ownership";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_ARTICLE_PROJECTION } from "@repo/backend/test/content/runtime";
import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type ArticleEntry = WithoutSystemFields<Doc<"articleCatalog">>;

/** Builds one complete current article row for the category ownership seam. */
function articleEntry(options?: {
  readonly category?: string;
  readonly sequence?: number;
}): ArticleEntry {
  return {
    appLocale: TEST_ARTICLE_PROJECTION.appLocale,
    assetId: TEST_ARTICLE_PROJECTION.graph.assetId,
    bucket: "444",
    category: options?.category ?? TEST_ARTICLE_PROJECTION.category,
    categoryTitle: TEST_ARTICLE_PROJECTION.categoryTitle,
    contentKey: TEST_ARTICLE_PROJECTION.contentKey,
    datePublished: TEST_ARTICLE_PROJECTION.metadata.datePublished,
    projectionHash: `sha256:${"4".repeat(64)}`,
    publicPath: TEST_ARTICLE_PROJECTION.publicPath,
    releaseId: "release-article-write",
    rendererDomain: "politics",
    sequence: options?.sequence ?? 1,
    slot: "blue",
  };
}

/** Runs the category claim through the native Convex mutation boundary. */
function claim(ctx: MutationCtx) {
  return runConvexProgram(
    Effect.gen(function* () {
      const article = articleEntry();
      const route = TEST_ARTICLE_PROJECTION.categoryRouteSlug;
      yield* stageCategory(ctx, article, route);
      const predecessors = yield* loadPredecessorRoutes(
        ctx,
        article.slot,
        article.appLocale
      );
      yield* validateCategoryClaim(ctx, article, predecessors);
    })
  );
}

describe("contentRelease/article/ownership", () => {
  it("rejects conflicting metadata for one category", async () => {
    const conflict = convexTest(schema, convexModules);
    await conflict.mutation(async (ctx) => {
      await ctx.db.insert("articleCategories", {
        appLocale: "en",
        bucket: "aaa",
        category: "politics",
        contentKey: "articles/politics/first",
        projectionHash: `sha256:${"a".repeat(64)}`,
        releaseId: "release-conflict",
        rendererDomain: "politics",
        route: "government",
        sequence: 1,
        slot: "blue",
        title: TEST_ARTICLE_PROJECTION.categoryTitle,
      });
    });

    await expect(conflict.mutation(claim)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a final route claimed by another category", async () => {
    const conflict = convexTest(schema, convexModules);
    await conflict.mutation(async (ctx) => {
      await ctx.db.insert("articleCategories", {
        appLocale: "en",
        bucket: "aaa",
        category: "history",
        contentKey: "articles/history/first",
        projectionHash: `sha256:${"a".repeat(64)}`,
        releaseId: "release-conflict",
        rendererDomain: "politics",
        route: TEST_ARTICLE_PROJECTION.categoryRouteSlug,
        sequence: 0,
        slot: "blue",
        title: "History",
      });
    });

    await expect(conflict.mutation(claim)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a route claimed by a predecessor row without a stored route", async () => {
    const conflict = convexTest(schema, convexModules);
    await conflict.mutation(async (ctx) => {
      await ctx.db.insert("articleCatalog", {
        appLocale: "en",
        assetId: "asset:en:article:history:article:politics:first",
        bucket: "aaa",
        category: "history",
        categoryTitle: "History",
        contentKey: "articles/history/first",
        datePublished: "2026-07-22",
        projectionHash: `sha256:${"a".repeat(64)}`,
        publicPath: "articles/politics/first",
        releaseId: "release-predecessor",
        rendererDomain: "politics",
        sequence: 0,
        slot: "blue",
      });
      await ctx.db.insert("articleCategories", {
        appLocale: "en",
        bucket: "aaa",
        category: "history",
        contentKey: "articles/history/first",
        projectionHash: `sha256:${"a".repeat(64)}`,
        releaseId: "release-predecessor",
        rendererDomain: "politics",
        sequence: 0,
        slot: "blue",
        title: "History",
      });
    });

    await expect(conflict.mutation(claim)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("validates a predecessor category through its signed article route", async () => {
    const bridge = convexTest(schema, convexModules);
    const article = articleEntry({ sequence: 0 });
    await bridge.mutation(async (ctx) => {
      await ctx.db.insert("articleCatalog", article);
      await ctx.db.insert("articleCategories", {
        appLocale: article.appLocale,
        bucket: article.bucket,
        category: article.category,
        contentKey: article.contentKey,
        projectionHash: article.projectionHash,
        releaseId: article.releaseId,
        rendererDomain: article.rendererDomain,
        sequence: article.sequence,
        slot: article.slot,
        title: article.categoryTitle,
      });
    });

    await expect(
      bridge.mutation((ctx) =>
        runConvexProgram(
          Effect.gen(function* () {
            const predecessors = yield* loadPredecessorRoutes(
              ctx,
              article.slot,
              article.appLocale
            );
            return yield* validateCategoryClaim(ctx, article, predecessors);
          })
        )
      )
    ).resolves.toMatchObject({
      appLocale: article.appLocale,
      category: article.category,
      rendererDomain: article.rendererDomain,
      route: TEST_ARTICLE_PROJECTION.categoryRouteSlug,
      title: article.categoryTitle,
    });
  });

  it("rejects final member title and renderer divergence", async () => {
    const conflict = convexTest(schema, convexModules);
    const categoryId = await conflict.mutation((ctx) =>
      ctx.db.insert("articleCategories", {
        appLocale: "en",
        bucket: "aaa",
        category: "politics",
        contentKey: TEST_ARTICLE_PROJECTION.contentKey,
        projectionHash: `sha256:${"a".repeat(64)}`,
        releaseId: "release-conflict",
        rendererDomain: "politics",
        route: TEST_ARTICLE_PROJECTION.categoryRouteSlug,
        sequence: 1,
        slot: "blue",
        title: "Public affairs",
      })
    );
    await expect(
      conflict.mutation((ctx) =>
        runConvexProgram(
          Effect.gen(function* () {
            const article = articleEntry();
            const predecessors = yield* loadPredecessorRoutes(
              ctx,
              article.slot,
              article.appLocale
            );
            return yield* validateCategoryClaim(ctx, article, predecessors);
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await conflict.mutation((ctx) =>
      ctx.db.patch("articleCategories", categoryId, {
        rendererDomain: "site",
        title: TEST_ARTICLE_PROJECTION.categoryTitle,
      })
    );
    await expect(
      conflict.mutation((ctx) =>
        runConvexProgram(
          Effect.gen(function* () {
            const article = articleEntry();
            const predecessors = yield* loadPredecessorRoutes(
              ctx,
              article.slot,
              article.appLocale
            );
            return yield* validateCategoryClaim(ctx, article, predecessors);
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects an unbounded predecessor category inventory", async () => {
    const oversized = convexTest(schema, convexModules);
    await oversized.mutation(async (ctx) => {
      for (let index = 0; index <= CONTENT_BUCKET_SIZE; index += 1) {
        await ctx.db.insert("articleCategories", {
          appLocale: "en",
          bucket: "aaa",
          category: `history-${index}`,
          contentKey: `articles/history-${index}/first`,
          projectionHash: `sha256:${"a".repeat(64)}`,
          releaseId: "release-predecessor",
          rendererDomain: "politics",
          sequence: 0,
          slot: "blue",
          title: `History ${index}`,
        });
      }
    });

    await expect(oversized.mutation(claim)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
