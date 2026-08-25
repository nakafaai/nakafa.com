import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  insertRuntimeRelease,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const categories = api.contentRelease.article.categories;
const page = api.contentRelease.article.page;

describe("contentRelease/article", () => {
  it("returns localized categories and newest articles through exact indexes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 2));

    const categoryPage = await t.query(categories, {
      expectedManifestHash: null,
      expectedReleaseId: null,
      appLocale: "en",
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
            route: "politics",
            title: "Politics",
          },
        ],
      },
      sourceRevision: "a".repeat(40),
    });
    const first = await t.query(page, {
      category: "politics",
      expectedManifestHash: null,
      expectedReleaseId: null,
      appLocale: "en",
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
      appLocale: "en",
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

  it("paginates legacy article rows by their truthful publication date", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 2);
      const rows = await ctx.db.query("articleCatalog").collect();

      for (const row of rows) {
        if (!("datePublished" in row)) {
          throw new Error("Expected one current article date shape.");
        }
        const {
          _creationTime: _createdAt,
          _id,
          dateModified: _dateModified,
          datePublished,
          ...fields
        } = row;
        await ctx.db.replace("articleCatalog", _id, {
          ...fields,
          date: datePublished,
        });
      }
    });

    const result = await t.query(page, {
      category: "politics",
      expectedManifestHash: null,
      expectedReleaseId: null,
      appLocale: "en",
      paginationOpts: { cursor: null, numItems: 1 },
    });

    expect(result.result.page).toMatchObject([
      { contentKey: testArticleProjection(1).contentKey },
    ]);
  });

  it("paginates mixed transition rows without hiding either date shape", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 3);
      const rows = await ctx.db.query("articleCatalog").collect();
      const legacy = rows.find(
        (row) => row.contentKey === testArticleProjection(1).contentKey
      );
      if (!(legacy && "datePublished" in legacy)) {
        throw new Error("Expected one current article date shape.");
      }
      const {
        _creationTime: _createdAt,
        _id,
        dateModified: _dateModified,
        datePublished,
        ...fields
      } = legacy;
      await ctx.db.replace("articleCatalog", _id, {
        ...fields,
        date: datePublished,
      });
    });

    const first = await t.query(page, {
      category: "politics",
      expectedManifestHash: null,
      expectedReleaseId: null,
      appLocale: "en",
      paginationOpts: { cursor: null, numItems: 1 },
    });
    const second = await t.query(page, {
      category: "politics",
      expectedManifestHash: first.activeManifestHash,
      expectedReleaseId: first.activeReleaseId,
      appLocale: "en",
      paginationOpts: {
        cursor: first.result.continueCursor,
        numItems: 1,
      },
    });
    const third = await t.query(page, {
      category: "politics",
      expectedManifestHash: second.activeManifestHash,
      expectedReleaseId: second.activeReleaseId,
      appLocale: "en",
      paginationOpts: {
        cursor: second.result.continueCursor,
        numItems: 1,
      },
    });

    expect([
      ...first.result.page,
      ...second.result.page,
      ...third.result.page,
    ]).toMatchObject(
      [2, 1, 0].map((index) => ({
        contentKey: testArticleProjection(index).contentKey,
      }))
    );
    expect(third.result.isDone).toBe(true);
  });

  it("keeps absent article ownership unmanaged before the first cutover", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).resolves.toMatchObject({
      activeManifestHash: null,
      activeReleaseId: null,
      managed: false,
      result: { isDone: true, page: [] },
    });
    const materialOnly = convexTest(schema, convexModules);
    await materialOnly.mutation((ctx) =>
      insertRuntimeRelease(ctx, ["material"])
    );
    await expect(
      materialOnly.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).resolves.toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      managed: false,
      result: { isDone: true, page: [] },
    });
  });

  it("fails closed for pending, stale, and malformed catalog models", async () => {
    const pending = convexTest(schema, convexModules);
    await pending.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const [row, state] = await Promise.all([
        ctx.db.query("articleCatalog").unique(),
        ctx.db.query("contentState").unique(),
      ]);
      if (!(row && state)) {
        throw new Error("Expected a synchronizing article model.");
      }
      await ctx.db.patch("articleCatalog", row._id, {
        categoryTitle: "Pending",
      });
      await ctx.db.patch("contentState", state._id, {
        articleManifestHash: undefined,
        articleReleaseId: undefined,
        articleSequence: undefined,
      });
    });
    await expect(
      pending.query(categories, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      pending.query(page, {
        category: "politics",
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale: "en",
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
        appLocale: "en",
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
        appLocale: "en",
        paginationOpts: { cursor: null, numItems: 1 },
      })
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
        appLocale: "en",
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
        appLocale: "en",
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
        appLocale: "en",
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
