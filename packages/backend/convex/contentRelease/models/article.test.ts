import { assert, describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { reconcileArticleModel } from "@repo/backend/convex/contentRelease/models/article";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { categorizedArticle } from "@repo/backend/test/article/release";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { convexTest, type TestConvex } from "convex-test";

async function reconcile(
  t: TestConvex<typeof schema>,
  build: Doc<"contentModelBuilds">
) {
  let writes = 0;
  for (const phase of [
    "articleCatalog",
    "articleCategories",
    "articleBuckets",
  ] as const) {
    let cursor: string | undefined;
    let pages = 0;
    do {
      const result = await t.mutation(async (ctx) => ({
        page: await runConvexProgram(
          reconcileArticleModel(ctx, { ...build, phase, cursor })
        ),
        metrics: await ctx.meta.getTransactionMetrics(),
      }));
      writes += result.metrics.documentsWritten.used;
      cursor = result.page.cursor;
      pages += 1;
    } while (cursor !== undefined && pages < 100);
    expect(cursor).toBeUndefined();
  }
  return writes;
}

function read(t: TestConvex<typeof schema>, slot: ModelSlot) {
  return t.query(async (ctx) => ({
    catalog: await ctx.db
      .query("articleCatalog")
      .withIndex(
        "by_slot_and_appLocale_and_datePublished_and_contentKey",
        (index) => index.eq("slot", slot)
      )
      .order("desc")
      .take(100),
    categories: await ctx.db
      .query("articleCategories")
      .withIndex("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", slot)
      )
      .take(100),
    buckets: await ctx.db
      .query("articleBuckets")
      .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
        index.eq("slot", slot)
      )
      .take(100),
  }));
}

function values(
  row: Doc<"articleCatalog" | "articleCategories" | "articleBuckets">
) {
  const { _creationTime, _id, slot, ...fields } = row;
  return fields;
}

describe("contentRelease/models/article", () => {
  it("preserves article order, category ownership and bucket counts while repairing only dirty rows", async () => {
    const t = convexTest({
      schema,
      modules: convexModules,
      transactionLimits: true,
    });
    const build = await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 40, (index) =>
        categorizedArticle({
          article: index,
          category: `group-${index % 3}`,
          route: `group-${index % 3}`,
          title: `Category ${index % 3}`,
        })
      );
      return insertModelBuild(ctx, "articleCatalog");
    });
    const source = await read(t, "blue");
    const expected = {
      catalog: source.catalog.map(values),
      categories: source.categories.map(values),
      buckets: source.buckets.map(values),
    };
    expect(await reconcile(t, build)).toBe(
      source.catalog.length + source.categories.length + source.buckets.length
    );
    const initial = await read(t, "green");
    expect(await reconcile(t, build)).toBe(0);
    await expect(read(t, "green")).resolves.toEqual(initial);

    await t.mutation(async (ctx) => {
      const [missingArticle, changedArticle] = initial.catalog;
      const [missingCategory, changedCategory] = initial.categories;
      const [missingBucket, changedBucket] = initial.buckets;
      assert(
        missingArticle &&
          changedArticle &&
          missingCategory &&
          changedCategory &&
          missingBucket &&
          changedBucket
      );
      await ctx.db.delete("articleCatalog", missingArticle._id);
      await ctx.db.patch("articleCatalog", changedArticle._id, {
        dateModified: "2099-01-01",
      });
      const {
        _id: articleId,
        _creationTime: articleCreated,
        ...article
      } = missingArticle;
      await ctx.db.insert("articleCatalog", {
        ...article,
        contentKey: "article:aborted",
      });
      await ctx.db.delete("articleCategories", missingCategory._id);
      await ctx.db.patch("articleCategories", changedCategory._id, {
        title: "Aborted category",
        route: undefined,
      });
      const {
        _id: categoryId,
        _creationTime: categoryCreated,
        ...category
      } = missingCategory;
      await ctx.db.insert("articleCategories", {
        ...category,
        category: "aborted",
      });
      await ctx.db.delete("articleBuckets", missingBucket._id);
      await ctx.db.patch("articleBuckets", changedBucket._id, {
        articleCount: 999,
      });
      const {
        _id: bucketId,
        _creationTime: bucketCreated,
        ...bucket
      } = missingBucket;
      await ctx.db.insert("articleBuckets", { ...bucket, bucket: "aborted" });
    });

    expect(await reconcile(t, build)).toBe(9);
    const repaired = await read(t, "green");
    expect({
      catalog: repaired.catalog.map(values),
      categories: repaired.categories.map(values),
      buckets: repaired.buckets.map(values),
    }).toEqual(expected);
    await expect(read(t, "blue")).resolves.toEqual(source);
    expect(await reconcile(t, build)).toBe(0);
  });
});
