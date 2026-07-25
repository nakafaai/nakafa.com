import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  insertRuntimeRelease,
  TEST_RUNTIME_RELEASE,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { insertRuntimeKey } from "@repo/backend/test/runtime-head";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const categories = api.contentRelease.article.categories;
const category = api.contentRelease.article.category;
const page = api.contentRelease.article.page;
const sitemapBuckets = api.contentRelease.article.sitemapBuckets;
const sitemapPage = api.contentRelease.article.sitemapPage;

describe("contentRelease/article", () => {
  it("returns localized categories and newest articles through exact indexes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 2));

    const categoryPage = await t.query(categories, {
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(categoryPage).toMatchObject({
      activeManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      managed: true,
      result: {
        isDone: true,
        page: [
          {
            category: "politics",
            rendererDomain: "politics",
            title: "Politics",
          },
        ],
      },
      sourceRevision: "a".repeat(40),
    });
    await expect(
      t.query(category, { category: "politics", locale: "en" })
    ).resolves.toEqual({ exists: true, managed: true });
    await expect(
      t.query(category, { category: "public-affairs", locale: "en" })
    ).resolves.toEqual({ exists: false, managed: true });

    const first = await t.query(page, {
      category: "politics",
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
      paginationOpts: { cursor: null, numItems: 1 },
    });
    expect(first.result.page).toMatchObject([
      {
        contentKey: testArticleProjection(1).contentKey,
        family: "article",
      },
    ]);
    expect(first.result.isDone).toBe(false);
    const second = await t.query(page, {
      category: "politics",
      expectedManifestHash: first.activeManifestHash,
      expectedReleaseId: first.activeReleaseId,
      locale: "en",
      paginationOpts: {
        cursor: first.result.continueCursor,
        numItems: 1,
      },
    });
    expect(second.result.page).toMatchObject([
      { contentKey: testArticleProjection(0).contentKey },
    ]);
    expect(second.result.isDone).toBe(true);
  });

  it("keeps absent article ownership unmanaged before the first cutover", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).resolves.toMatchObject({
      activeManifestHash: null,
      activeReleaseId: null,
      managed: false,
      result: { isDone: true, page: [] },
    });
    await expect(
      empty.query(category, { category: "politics", locale: "en" })
    ).resolves.toEqual({ exists: false, managed: false });
    await expect(
      empty.query(sitemapBuckets, { locale: "en" })
    ).resolves.toEqual({
      articleCount: 0,
      buckets: [],
      managed: false,
    });
    await expect(
      empty.query(sitemapPage, { bucket: "abc", locale: "en" })
    ).resolves.toBeNull();

    const materialOnly = convexTest(schema, convexModules);
    await materialOnly.mutation((ctx) => insertRuntimeRelease(ctx));
    await expect(
      materialOnly.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).resolves.toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      managed: false,
      result: { isDone: true, page: [] },
    });
  });

  it("serves complete article and category sitemap partitions", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const row = await t.run((ctx) => ctx.db.query("articleCatalog").unique());
    if (!row) {
      throw new Error("Expected one active article row.");
    }

    await expect(t.query(sitemapBuckets, { locale: "en" })).resolves.toEqual({
      articleCount: 1,
      buckets: [row.bucket],
      managed: true,
    });
    await expect(
      t.query(sitemapPage, { bucket: row.bucket, locale: "en" })
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
      t.query(sitemapPage, { bucket: "fff", locale: "en" })
    ).resolves.toBeNull();
    await expect(
      t.query(sitemapPage, { bucket: "wrong", locale: "en" })
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
      t.query(sitemapBuckets, { locale: "en" })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("fails closed for pending, stale, and malformed catalog reads", async () => {
    const pending = convexTest(schema, convexModules);
    await pending.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const projection = testArticleProjection(0);
      await insertRuntimeKey(ctx, projection.contentKey, {
        projectionJson: canonicalizeArticleProjection(projection),
      });
    });
    await expect(
      pending.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });

    const stale = convexTest(schema, convexModules);
    await stale.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const row = await ctx.db.query("articleCatalog").unique();
      if (!row) {
        throw new Error("Expected one active article row.");
      }
      await ctx.db.patch("articleCatalog", row._id, {
        categoryTitle: "Changed",
      });
    });
    await expect(
      stale.query(page, {
        category: "politics",
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const missing = convexTest(schema, convexModules);
    await missing.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const row = await ctx.db.query("articleCatalog").unique();
      if (!row) {
        throw new Error("Expected one active article row.");
      }
      await ctx.db.delete("articleCatalog", row._id);
    });
    await expect(
      missing.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const count = convexTest(schema, convexModules);
    await count.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const bucket = await ctx.db.query("articleBuckets").unique();
      if (!bucket) {
        throw new Error("Expected one article sitemap bucket.");
      }
      await ctx.db.patch("articleBuckets", bucket._id, { articleCount: 2 });
    });
    const bucket = await count.run((ctx) =>
      ctx.db.query("articleBuckets").unique()
    );
    if (!bucket) {
      throw new Error("Expected one corrupted sitemap bucket.");
    }
    await expect(
      count.query(sitemapPage, { bucket: bucket.bucket, locale: "en" })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await count.mutation((ctx) =>
      ctx.db.patch("articleBuckets", bucket._id, { articleCount: -1 })
    );
    await expect(
      count.query(sitemapBuckets, { locale: "en" })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects invalid claims and marks superseded cursors for restart", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    await expect(
      t.query(page, {
        category: "Politics",
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      t.query(page, {
        category: "politics",
        expectedManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        expectedReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        locale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      t.query(page, {
        category: "politics",
        expectedManifestHash: "wrong",
        expectedReleaseId: "wrong",
        locale: "en",
        paginationOpts: { cursor: "stale", numItems: 1 },
      })
    ).resolves.toMatchObject({
      activeManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      managed: true,
      result: { isDone: true, page: [] },
      stale: true,
    });
  });
});
