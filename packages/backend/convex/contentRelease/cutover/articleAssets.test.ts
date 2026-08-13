import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  checkpointArticleAssetIds,
  proveArticleAssetIdsComplete,
  stageArticleAssetIds,
} from "@repo/backend/convex/contentRelease/cutover/articleAssets";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeArticles } from "@repo/backend/test/content-runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/articleAssets", () => {
  it("stages exact authenticated article identities idempotently", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 2);
      const articles = await ctx.db.query("articleCatalog").collect();
      for (const article of articles) {
        await ctx.db.patch("articleCatalog", article._id, {
          assetId: undefined,
        });
      }
      await insertQuiescentCheckpoint(ctx);
      const first = await runConvexProgram(stageArticleAssetIds(ctx, 2));
      const second = await runConvexProgram(stageArticleAssetIds(ctx, 2));
      const proved = await runConvexProgram(
        proveArticleAssetIdsComplete(ctx, 2, TEST_RUNTIME_RELEASE.sequence)
      );
      const receipt = await runConvexProgram(checkpointArticleAssetIds(ctx, 2));
      const stored = await ctx.db.query("articleCatalog").collect();
      const selected = stored[0];
      const asset = selected?.assetId
        ? await ctx.db
            .query("articleCatalog")
            .withIndex("by_assetId", (index) =>
              index.eq("assetId", selected.assetId)
            )
            .unique()
        : null;
      const route = selected
        ? await ctx.db
            .query("articleCatalog")
            .withIndex("by_locale_and_publicPath", (index) =>
              index
                .eq("locale", selected.locale)
                .eq("publicPath", selected.publicPath)
            )
            .unique()
        : null;
      const checkpoint = await ctx.db.query("contentCutoverState").unique();
      return {
        asset,
        checkpoint,
        first,
        proved,
        receipt,
        route,
        second,
        stored,
      };
    });

    expect(result.first).toEqual({
      complete: true,
      total: 2,
      unchanged: 0,
      updated: 2,
    });
    expect(result.second).toEqual({
      complete: true,
      total: 2,
      unchanged: 2,
      updated: 0,
    });
    expect(result.proved).toBe(2);
    expect(result.receipt.count).toBe(2);
    expect(result.checkpoint?.articleReferenceProof).toEqual(result.receipt);
    expect(result.stored.every(({ assetId }) => assetId !== undefined)).toBe(
      true
    );
    expect(result.asset?._id).toBe(result.stored[0]?._id);
    expect(result.route?._id).toBe(result.stored[0]?._id);
  });

  it("rejects a stored identity that differs from its signed projection", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const article = await ctx.db.query("articleCatalog").unique();
      if (!article) {
        throw new Error("Expected one article fixture.");
      }
      await ctx.db.patch("articleCatalog", article._id, {
        assetId: "asset:en:article:tampered",
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(stageArticleAssetIds(ctx, 1)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects duplicate authenticated article asset identities", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const article = await ctx.db.query("articleCatalog").unique();
      if (!article) {
        throw new Error("Expected one article catalog row.");
      }
      const { _creationTime: _, _id: __, ...duplicate } = article;
      await ctx.db.insert("articleCatalog", duplicate);
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          proveArticleAssetIdsComplete(ctx, 2, TEST_RUNTIME_RELEASE.sequence)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

async function insertQuiescentCheckpoint(ctx: MutationCtx) {
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: TEST_RUNTIME_RELEASE.releaseId,
    auditedActiveSequence: TEST_RUNTIME_RELEASE.sequence,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: TEST_RUNTIME_RELEASE.sequence + 1,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: 0,
    currentTablePreserved: 0,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 0,
    phase: "quiescent",
    updatedAt: 1,
  });
}
