import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  type ArticleProjection,
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncArticles } from "@repo/backend/convex/contentRelease/article/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertCompletedRelease,
  insertReleaseItem,
  selectActiveRelease,
} from "@repo/backend/test/content-read-model";
import { testArticleProjection } from "@repo/backend/test/content-runtime";
import {
  insertTestState,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const BASE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-article-sync-base",
  sequence: 1,
} satisfies TestIdentity;
const NEXT = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-article-sync-next",
  sequence: 2,
} satisfies TestIdentity;

/** Inserts one active public article version and its changed release item. */
async function insertArticle(
  ctx: MutationCtx,
  identity: TestIdentity,
  index: number,
  datePublished?: string
) {
  const projection = testArticleProjection(index, datePublished);
  await insertArticleProjection(ctx, identity, index, projection);
}

/** Inserts one exact article projection and its changed release identity. */
async function insertArticleProjection(
  ctx: MutationCtx,
  identity: TestIdentity,
  index: number,
  projection: ArticleProjection
) {
  const projectionJson = canonicalizeArticleProjection(projection);
  await insertReleaseItem(
    ctx,
    identity,
    projection.contentKey,
    index,
    "article"
  );
  await insertRuntimeVersion(ctx, "public", projection.contentKey, {
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    projectionJson,
    publicPath: projection.publicPath,
    rendererDomain: "politics",
  });
  await insertRuntimeBinding(ctx, projection.contentKey, {
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath: projection.publicPath,
  });
}

/** Builds one source category with an independently localized public route. */
function categorizedArticle(options: {
  readonly article: number;
  readonly category: string;
  readonly route: string;
  readonly title: string;
}) {
  const source = testArticleProjection(options.article);
  const articleSlug = source.articleSlug;
  const category = ArticleCategorySchema.make(options.category);
  const categoryRouteSlug = ArticleRouteSlugSchema.make(options.route);
  const contentKey = ContentKeySchema.make(
    `articles/${category}/${articleSlug}`
  );
  const lens = `article:${category}`;
  const object = `${lens}:${articleSlug}`;
  return ArticleProjectionSchema.make({
    ...source,
    category,
    categoryRouteSlug,
    categoryTitle: options.title,
    contentKey,
    graph: {
      alignmentId: `alignment:${lens}:${object}`,
      assetId: `asset:en:${lens}:${object}`,
      conceptId: `concept:${lens}`,
      learningObjectId: `lo:${object}`,
      lensId: `lens:${lens}`,
    },
    parentPath: PublicPathSchema.make(`articles/${categoryRouteSlug}`),
    publicPath: PublicPathSchema.make(
      `articles/${categoryRouteSlug}/${source.articleRouteSlug}`
    ),
  });
}

describe("contentRelease/article/sync", () => {
  it("publishes one bounded article model atomically", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 8);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      for (let index = 0; index < 8; index += 1) {
        await insertArticle(ctx, BASE, index);
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 7, processed: 8 });

    const stored = await t.run(async (ctx) => ({
      categories: await ctx.db.query("articleCategories").take(2),
      rows: await ctx.db.query("articleCatalog").take(10),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.rows).toHaveLength(8);
    expect(stored.categories).toMatchObject([
      { category: "politics", title: "Politics" },
    ]);
    expect(stored.state).toMatchObject({
      articleManifestHash: BASE.manifestHash,
      articleReleaseId: BASE.releaseId,
      articleSequence: BASE.sequence,
    });
  });

  it("continues article models larger than one transaction page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 9);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      for (let index = 0; index < 9; index += 1) {
        await insertArticle(ctx, BASE, index);
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 8, processed: 1 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 8, processed: 1 });
    await expect(
      t.run((ctx) => ctx.db.query("articleCatalog").take(10))
    ).resolves.toHaveLength(9);
  });

  it("replaces, deletes, and idempotently replays changed articles", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 3);
      await insertTestState(ctx, { active: BASE, nextSequence: 3 });
      for (let index = 0; index < 3; index += 1) {
        await insertArticle(ctx, BASE, index);
      }
    });
    await t.mutation((ctx) =>
      runConvexProgram(syncArticles(ctx, BASE.releaseId))
    );
    await t.mutation((ctx) =>
      runConvexProgram(syncArticles(ctx, BASE.releaseId))
    );
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 3, BASE);
      await insertArticle(ctx, NEXT, 0, "2026-08-01");
      for (const index of [1, 2]) {
        const projection = testArticleProjection(index);
        await insertReleaseItem(
          ctx,
          NEXT,
          projection.contentKey,
          index,
          "article"
        );
      }
      await ctx.db.insert("contentHeads", {
        artifactLocale: "en",
        contentKey: testArticleProjection(1).contentKey,
        family: "article",
        index: 1,
        operation: "delete",
        releaseId: NEXT.releaseId,
        sequence: NEXT.sequence,
      });
      await insertRuntimeVersion(
        ctx,
        "authenticated",
        testArticleProjection(2).contentKey,
        {
          headReleaseId: NEXT.releaseId,
          headSequence: NEXT.sequence,
          projectionJson: canonicalizeArticleProjection(
            testArticleProjection(2)
          ),
          publicPath: testArticleProjection(2).publicPath,
          rendererDomain: "politics",
        }
      );
      await selectActiveRelease(ctx, NEXT);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 2, processed: 3 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 2, processed: 3 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 2, processed: 0 });
    const rows = await t.run((ctx) => ctx.db.query("articleCatalog").take(4));
    expect(rows).toMatchObject([
      {
        contentKey: testArticleProjection(0).contentKey,
        datePublished: "2026-08-01",
        releaseId: NEXT.releaseId,
      },
    ]);
  });

  it("publishes a claimant-first category route transfer", async () => {
    const t = convexTest(schema, convexModules);
    const owner = categorizedArticle({
      article: 0,
      category: "politics",
      route: "public-affairs",
      title: "Politics",
    });
    const claimantPredecessor = categorizedArticle({
      article: 1,
      category: "history",
      route: "history",
      title: "History",
    });
    const fillers = Array.from({ length: 7 }, (_, index) =>
      categorizedArticle({
        article: index + 2,
        category: `topic-${index}`,
        route: `topic-${index}`,
        title: `Topic ${index}`,
      })
    );
    const predecessor = [owner, ...fillers, claimantPredecessor];
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, predecessor.length);
      await insertTestState(ctx, { active: BASE, nextSequence: 3 });
      for (const [index, projection] of predecessor.entries()) {
        await insertArticleProjection(ctx, BASE, index, projection);
      }
    });
    for (let page = 0; page < 4; page += 1) {
      await t.mutation((ctx) =>
        runConvexProgram(syncArticles(ctx, BASE.releaseId))
      );
    }

    const claimant = categorizedArticle({
      article: 1,
      category: "history",
      route: "public-affairs",
      title: "History",
    });
    const relinquishingOwner = categorizedArticle({
      article: 0,
      category: "politics",
      route: "government",
      title: "Politics",
    });
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 9, BASE);
      await insertArticleProjection(ctx, NEXT, 0, claimant);
      for (const [index, projection] of fillers.entries()) {
        await insertArticleProjection(ctx, NEXT, index + 1, projection);
      }
      await insertArticleProjection(ctx, NEXT, 8, relinquishingOwner);
      await selectActiveRelease(ctx, NEXT);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    const pending = await t.run(async (ctx) => ({
      routes: await ctx.db
        .query("articleCategories")
        .withIndex("by_appLocale_and_route", (index) =>
          index.eq("appLocale", "en").eq("route", "public-affairs")
        )
        .take(3),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(pending.routes).toHaveLength(2);
    expect(pending.state).toMatchObject({
      articleReleaseId: BASE.releaseId,
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 8, processed: 1 });
    const staged = await t.run(async (ctx) => ({
      categories: await ctx.db.query("articleCategories").take(10),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(staged.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "history",
          route: "public-affairs",
        }),
        expect.objectContaining({
          category: "politics",
          route: "government",
        }),
      ])
    );
    expect(staged.state).toMatchObject({
      articleReleaseId: BASE.releaseId,
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 8, processed: 1 });
    await expect(
      t.run((ctx) => ctx.db.query("contentState").unique())
    ).resolves.toMatchObject({ articleReleaseId: NEXT.releaseId });
  });

  it("rejects a final category route collision before publication", async () => {
    const t = convexTest(schema, convexModules);
    const owner = categorizedArticle({
      article: 0,
      category: "politics",
      route: "public-affairs",
      title: "Politics",
    });
    const predecessorClaimant = categorizedArticle({
      article: 1,
      category: "history",
      route: "history",
      title: "History",
    });
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 2);
      await insertTestState(ctx, { active: BASE, nextSequence: 3 });
      await insertArticleProjection(ctx, BASE, 0, owner);
      await insertArticleProjection(ctx, BASE, 1, predecessorClaimant);
    });
    await t.mutation((ctx) =>
      runConvexProgram(syncArticles(ctx, BASE.releaseId))
    );
    await t.mutation((ctx) =>
      runConvexProgram(syncArticles(ctx, BASE.releaseId))
    );

    const conflictingClaimant = categorizedArticle({
      article: 1,
      category: "history",
      route: "public-affairs",
      title: "History",
    });
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 1, BASE);
      await insertArticleProjection(ctx, NEXT, 0, conflictingClaimant);
      await selectActiveRelease(ctx, NEXT);
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 0, processed: 1 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const blocked = await t.run(async (ctx) => ({
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", NEXT.releaseId)
        )
        .unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(blocked.release).toMatchObject({ articleIndex: 0 });
    expect(blocked.release).not.toHaveProperty("articleRouteIndex");
    expect(blocked.release).not.toHaveProperty("articleSyncedAt");
    expect(blocked.state).toMatchObject({
      articleReleaseId: BASE.releaseId,
    });
  });

  it("rejects a non-contiguous release page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 1);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      await insertReleaseItem(
        ctx,
        BASE,
        testArticleProjection(0).contentKey,
        1,
        "article"
      );
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
