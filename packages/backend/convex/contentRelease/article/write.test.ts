import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  deleteArticle,
  writeArticle,
} from "@repo/backend/convex/contentRelease/article/write";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_ARTICLE_PROJECTION,
  TEST_ARTICLE_PROJECTION_JSON,
} from "@repo/backend/test/content-runtime";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

type ContentHead = WithoutSystemFields<Doc<"contentHeads">>;

/** Builds one complete active article head for the writer boundary. */
function testHead(options?: {
  readonly delivery?: ContentHead["delivery"];
  readonly operation?: ContentHead["operation"];
  readonly projectionHash?: string;
  readonly sequence?: number;
}): ContentHead {
  return {
    artifactHash: `sha256:${"2".repeat(64)}`,
    artifactLocale: "en",
    compilerConfigHash: `sha256:${"3".repeat(64)}`,
    contentKey: TEST_ARTICLE_PROJECTION.contentKey,
    delivery: options?.delivery ?? "public",
    family: "article",
    index: 0,
    operation: options?.operation ?? "upsert",
    projectionHash: options?.projectionHash ?? `sha256:${"4".repeat(64)}`,
    projectionJson: TEST_ARTICLE_PROJECTION_JSON,
    releaseId: "release-article-write",
    rendererDomain: "politics",
    sequence: options?.sequence ?? 1,
    sourceHash: `sha256:${"5".repeat(64)}`,
    sourcePath:
      "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx",
  };
}

/** Runs the writer through the native Convex mutation boundary. */
function write(
  ctx: MutationCtx,
  head = testHead(),
  projection: ArticleProjection = TEST_ARTICLE_PROJECTION
) {
  return runConvexProgram(writeArticle(ctx, head, projection));
}

describe("contentRelease/article/write", () => {
  it("replaces one article identity and its localized category row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => write(ctx));
    await t.mutation((ctx) => write(ctx));
    const dates = normalizePublicationDates(TEST_ARTICLE_PROJECTION.metadata);
    await t.mutation((ctx) =>
      write(ctx, testHead({ sequence: 2 }), {
        ...TEST_ARTICLE_PROJECTION,
        categoryTitle: "Public Affairs",
        metadata: {
          authors: TEST_ARTICLE_PROJECTION.metadata.authors,
          dateModified: "2026-07-24",
          datePublished: dates.datePublished,
          title: TEST_ARTICLE_PROJECTION.metadata.title,
        },
      })
    );

    const rows = await t.run((ctx) => ctx.db.query("articleCatalog").take(2));
    const stored = await t.run(async (ctx) => ({
      buckets: await ctx.db.query("articleBuckets").take(2),
      categories: await ctx.db.query("articleCategories").take(2),
    }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assetId: TEST_ARTICLE_PROJECTION.graph.assetId,
      categoryTitle: "Public Affairs",
      date: TEST_ARTICLE_PROJECTION.metadata.datePublished,
      dateModified: "2026-07-24",
      datePublished: TEST_ARTICLE_PROJECTION.metadata.datePublished,
      sequence: 2,
    });
    expect(stored.categories).toHaveLength(1);
    expect(stored.categories[0]).toMatchObject({
      bucket: "444",
      route: TEST_ARTICLE_PROJECTION.categoryRouteSlug,
      title: "Public Affairs",
    });
    expect(stored.buckets).toMatchObject([
      {
        articleCount: 1,
        bucket: "444",
        categoryCount: 1,
      },
    ]);
  });

  it("reconciles a prior category and removes an empty category", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("articleCatalog", {
        appLocale: "en",
        assetId: TEST_ARTICLE_PROJECTION.graph.assetId,
        bucket: "111",
        category: "history",
        categoryTitle: "History",
        contentKey: TEST_ARTICLE_PROJECTION.contentKey,
        date: "2026-07-22",
        projectionHash: `sha256:${"1".repeat(64)}`,
        publicPath: TEST_ARTICLE_PROJECTION.publicPath,
        releaseId: "release-old",
        rendererDomain: "politics",
        sequence: 0,
      });
      await ctx.db.insert("articleCategories", {
        appLocale: "en",
        bucket: "111",
        category: "history",
        contentKey: TEST_ARTICLE_PROJECTION.contentKey,
        projectionHash: `sha256:${"1".repeat(64)}`,
        releaseId: "release-old",
        rendererDomain: "politics",
        sequence: 0,
        title: "History",
      });
      await ctx.db.insert("articleBuckets", {
        appLocale: "en",
        articleCount: 1,
        bucket: "111",
        categoryCount: 1,
      });
      await write(ctx);
    });

    await expect(
      t.run(async (ctx) => ({
        articles: await ctx.db.query("articleCatalog").take(2),
        categories: await ctx.db.query("articleCategories").take(2),
      }))
    ).resolves.toMatchObject({
      articles: [
        {
          date: TEST_ARTICLE_PROJECTION.metadata.datePublished,
          datePublished: TEST_ARTICLE_PROJECTION.metadata.datePublished,
        },
      ],
      categories: [{ category: "politics" }],
    });
    await t.mutation((ctx) =>
      runConvexProgram(
        deleteArticle(
          ctx,
          TEST_ARTICLE_PROJECTION.contentKey,
          TEST_ARTICLE_PROJECTION.appLocale
        )
      )
    );
    await t.mutation((ctx) =>
      runConvexProgram(
        deleteArticle(
          ctx,
          TEST_ARTICLE_PROJECTION.contentKey,
          TEST_ARTICLE_PROJECTION.appLocale
        )
      )
    );
    await expect(
      t.run(async (ctx) => ({
        buckets: await ctx.db.query("articleBuckets").take(1),
        categories: await ctx.db.query("articleCategories").take(1),
      }))
    ).resolves.toEqual({ buckets: [], categories: [] });
  });

  it("rejects conflicting category metadata and unsafe heads", async () => {
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
        sequence: 1,
        title: "Political Affairs",
      });
    });
    await expect(conflict.mutation((ctx) => write(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const invalid = convexTest(schema, convexModules);
    for (const head of [
      testHead({ delivery: "authenticated" }),
      testHead({ operation: "delete" }),
      testHead({ projectionHash: "" }),
    ]) {
      await expect(
        invalid.mutation((ctx) => write(ctx, head))
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    }
    await expect(
      invalid.mutation((ctx) =>
        write(ctx, testHead(), {
          ...TEST_ARTICLE_PROJECTION,
          categoryTitle: "x".repeat(READ_MODEL_DOCUMENT_LIMIT),
        })
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_SIZE" },
    });
  });

  it("rejects a conflicting localized category route", async () => {
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
        title: TEST_ARTICLE_PROJECTION.categoryTitle,
      });
    });

    await expect(conflict.mutation((ctx) => write(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a route claimed by another active release sequence", async () => {
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
        title: "History",
      });
    });

    await expect(conflict.mutation((ctx) => write(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
