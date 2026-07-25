import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncArticles } from "@repo/backend/convex/contentRelease/article/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArticleProjection } from "@repo/backend/test/content-runtime";
import {
  insertTestState,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertCompletedRelease,
  insertReleaseItem,
  selectActiveRelease,
} from "@repo/backend/test/content-sync";
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
  date?: string
) {
  const projection = testArticleProjection(index, date);
  const projectionJson = canonicalizeArticleProjection(projection);
  await insertReleaseItem(ctx, identity, projection.contentKey, index);
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

describe("contentRelease/article/sync", () => {
  it("resumes bounded pages and publishes article identity when complete", async () => {
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
    ).resolves.toEqual({ complete: false, processed: 8 });
    const pending = await t.run((ctx) => ctx.db.query("contentState").unique());
    expect(pending?.articleReleaseId).toBeUndefined();
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).resolves.toEqual({ complete: true, processed: 1 });

    const stored = await t.run(async (ctx) => ({
      categories: await ctx.db.query("articleCategories").take(2),
      release: await ctx.db.query("contentReleases").unique(),
      rows: await ctx.db.query("articleCatalog").take(10),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.rows).toHaveLength(9);
    expect(stored.categories).toMatchObject([
      { category: "politics", title: "Politics" },
    ]);
    expect(stored.release).toMatchObject({
      articleIndex: 8,
      articleSyncedAt: expect.any(Number),
    });
    expect(stored.state).toMatchObject({
      articleManifestHash: BASE.manifestHash,
      articleReleaseId: BASE.releaseId,
      articleSequence: BASE.sequence,
    });
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
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 3, BASE);
      await insertArticle(ctx, NEXT, 0, "2026-08-01");
      for (const index of [1, 2]) {
        const projection = testArticleProjection(index);
        await insertReleaseItem(ctx, NEXT, projection.contentKey, index);
      }
      await ctx.db.insert("contentHeads", {
        contentKey: testArticleProjection(1).contentKey,
        family: "article",
        index: 1,
        locale: "en",
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
    ).resolves.toEqual({ complete: true, processed: 3 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ complete: true, processed: 0 });
    const rows = await t.run((ctx) => ctx.db.query("articleCatalog").take(4));
    expect(rows).toMatchObject([
      {
        contentKey: testArticleProjection(0).contentKey,
        date: "2026-08-01",
        releaseId: NEXT.releaseId,
      },
    ]);
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
        1
      );
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncArticles(ctx, BASE.releaseId)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
