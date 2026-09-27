import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  reconcileCategory,
  stageCategory,
  validateCategoryClaim,
} from "@repo/backend/confect/contentRelease/article/ownership";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
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
  return Effect.gen(function* () {
    const article = articleEntry();
    const route = TEST_ARTICLE_PROJECTION.categoryRouteSlug;
    yield* stageCategory(article, route);
    yield* validateCategoryClaim(article);
  }).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}
describe("contentRelease/article/ownership", () => {
  it.each(["material/politics/article", "articles/Invalid Category/article"])(
    "preserves the category when a surviving article has invalid path %s",
    async (publicPath) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) => Effect.runPromise(claim(ctx)));
      const before = await t.query((ctx) =>
        ctx.db.query("articleCategories").unique()
      );
      await t.mutation((ctx) =>
        ctx.db.insert("articleCatalog", {
          ...articleEntry(),
          publicPath,
        })
      );
      await expect(
        t.mutation((ctx) =>
          Effect.runPromise(
            reconcileCategory("blue", "en", "politics").pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      expect(
        await t.query((ctx) => ctx.db.query("articleCategories").unique())
      ).toEqual(before);
    }
  );
  it("removes the last category once when its representative disappears", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => Effect.runPromise(claim(ctx)));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await t.mutation((ctx) =>
        Effect.runPromise(
          reconcileCategory("blue", "en", "politics").pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      );
      expect(
        await t.query((ctx) => ctx.db.query("articleCategories").collect())
      ).toEqual([]);
    }
    expect(
      await t.query((ctx) => ctx.db.query("articleBuckets").collect())
    ).toEqual([]);
  });
  it.each(["duplicate", "invalid-route"] as const)(
    "rejects a %s category owner before publication",
    async (corruption) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) => Effect.runPromise(claim(ctx)));
      await t.mutation(async (ctx) => {
        const category = await ctx.db.query("articleCategories").unique();
        assert(category);
        if (corruption === "duplicate") {
          const { _id, _creationTime, ...fields } = category;
          await ctx.db.insert("articleCategories", fields);
        } else {
          await ctx.db.patch(category._id, {
            route: "invalid/route",
          });
        }
      });
      const before = await t.query((ctx) =>
        ctx.db.query("articleCategories").collect()
      );
      await expect(
        t.mutation((ctx) =>
          Effect.runPromise(
            validateCategoryClaim(articleEntry()).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      expect(
        await t.query((ctx) => ctx.db.query("articleCategories").collect())
      ).toEqual(before);
    }
  );
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
    await expect(
      conflict.mutation((ctx) => Effect.runPromise(claim(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
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
    await expect(
      conflict.mutation((ctx) => Effect.runPromise(claim(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
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
        Effect.runPromise(
          Effect.gen(function* () {
            const article = articleEntry();
            return yield* validateCategoryClaim(article);
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    await conflict.mutation((ctx) =>
      ctx.db.patch("articleCategories", categoryId, {
        rendererDomain: "site",
        title: TEST_ARTICLE_PROJECTION.categoryTitle,
      })
    );
    await expect(
      conflict.mutation((ctx) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const article = articleEntry();
            return yield* validateCategoryClaim(article);
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
});
