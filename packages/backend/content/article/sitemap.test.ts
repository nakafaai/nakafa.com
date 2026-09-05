import { describe, expect, it } from "@effect/vitest";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/content/article/sitemap";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/article/sitemap", () => {
  it("keeps sitemap ownership absent before the article cutover", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleBuckets("en").pipe(Effect.provide(convexArticleLayer(ctx)))
        )
      )
    ).resolves.toEqual({
      activeReleaseId: null,
      articleCount: 0,
      buckets: [],
      managed: false,
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleSitemap("en", "abc").pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
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
      t.query((ctx) =>
        runConvexProgram(
          readArticleBuckets("en").pipe(Effect.provide(convexArticleLayer(ctx)))
        )
      )
    ).resolves.toEqual({
      activeReleaseId: expect.any(String),
      articleCount: 1,
      buckets: [row.bucket],
      managed: true,
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleSitemap("en", row.bucket).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      routes: [
        {
          publicPath: "articles/politics",
        },
        {
          lastModified: testArticleProjection(0).metadata.datePublished,
          publicPath: testArticleProjection(0).publicPath,
        },
      ],
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleSitemap("en", "fff").pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).resolves.toBeNull();
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleSitemap("en", "wrong").pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it.each(["id", "de"] as const)(
    "uses signed %s category and article routes instead of canonical identity keys",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        insertRuntimeArticles(ctx, 1, (index) =>
          testLocalizedArticleProjection(index, appLocale)
        )
      );
      const row = await t.run((ctx) => ctx.db.query("articleCatalog").unique());
      if (!row) {
        throw new Error("Expected one localized article row.");
      }

      const projection = testLocalizedArticleProjection(0, appLocale);
      await expect(
        t.query((ctx) =>
          runConvexProgram(
            readArticleSitemap(appLocale, row.bucket).pipe(
              Effect.provide(convexArticleLayer(ctx))
            )
          )
        )
      ).resolves.toMatchObject({
        routes: [
          {
            publicPath: projection.parentPath,
          },
          {
            lastModified: projection.metadata.datePublished,
            publicPath: projection.publicPath,
          },
        ],
      });
    }
  );

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
          appLocale: "en",
          articleCount: 1,
          bucket,
          categoryCount: 0,
          slot: "blue",
        });
      }
      await ctx.db.insert("articleBuckets", {
        appLocale: "en",
        articleCount: 1,
        bucket: "zzz",
        categoryCount: 0,
        slot: "blue",
      });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleBuckets("en").pipe(Effect.provide(convexArticleLayer(ctx)))
        )
      )
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
        runConvexProgram(
          readArticleSitemap("en", bucket.bucket).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("articleBuckets", bucket._id, { articleCount: -1 })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readArticleBuckets("en").pipe(Effect.provide(convexArticleLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
