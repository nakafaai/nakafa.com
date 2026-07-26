import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/convex/contentRelease/article/sitemap";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/article/sitemap", () => {
  it("keeps sitemap ownership absent before the article cutover", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readArticleBuckets(ctx, "en")))
    ).resolves.toEqual({
      articleCount: 0,
      buckets: [],
      managed: false,
    });
    await expect(
      t.query((ctx) => runConvexProgram(readArticleSitemap(ctx, "en", "abc")))
    ).resolves.toBeNull();
  });

  it("serves complete article and category sitemap partitions", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const row = await t.run((ctx) => ctx.db.query("articleCatalog").unique());
    if (!row) {
      throw new Error("Expected one active article row.");
    }

    await expect(
      t.query((ctx) => runConvexProgram(readArticleBuckets(ctx, "en")))
    ).resolves.toEqual({
      articleCount: 1,
      buckets: [row.bucket],
      managed: true,
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(readArticleSitemap(ctx, "en", row.bucket))
      )
    ).resolves.toMatchObject({
      routes: [
        { date: null, publicPath: "articles/politics" },
        {
          date: testArticleProjection(0).metadata.date,
          publicPath: testArticleProjection(0).publicPath,
        },
      ],
    });
    await expect(
      t.query((ctx) => runConvexProgram(readArticleSitemap(ctx, "en", "fff")))
    ).resolves.toBeNull();
    await expect(
      t.query((ctx) => runConvexProgram(readArticleSitemap(ctx, "en", "wrong")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("rejects sitemap metadata outside the fixed partition space", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const existing = await ctx.db.query("articleBuckets").unique();
      if (!existing) {
        throw new Error("Expected one active article bucket.");
      }
      for (let index = 0; index < 4096; index += 1) {
        const bucket = index.toString(16).padStart(3, "0");
        if (bucket === existing.bucket) {
          continue;
        }
        await ctx.db.insert("articleBuckets", {
          articleCount: 1,
          bucket,
          categoryCount: 0,
          locale: "en",
        });
      }
      await ctx.db.insert("articleBuckets", {
        articleCount: 1,
        bucket: "zzz",
        categoryCount: 0,
        locale: "en",
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(readArticleBuckets(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a sitemap partition with corrupted counts", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const bucket = await ctx.db.query("articleBuckets").unique();
      if (!bucket) {
        throw new Error("Expected one article sitemap bucket.");
      }
      await ctx.db.patch("articleBuckets", bucket._id, { articleCount: 2 });
    });
    const bucket = await t.run((ctx) =>
      ctx.db.query("articleBuckets").unique()
    );
    if (!bucket) {
      throw new Error("Expected one corrupted sitemap bucket.");
    }

    await expect(
      t.query((ctx) =>
        runConvexProgram(readArticleSitemap(ctx, "en", bucket.bucket))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("articleBuckets", bucket._id, { articleCount: -1 })
    );
    await expect(
      t.query((ctx) => runConvexProgram(readArticleBuckets(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
