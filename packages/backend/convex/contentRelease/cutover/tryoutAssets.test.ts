import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  checkpointTryoutAssetIds,
  proveTryoutAssetIdsComplete,
  stageTryoutAssetIds,
} from "@repo/backend/convex/contentRelease/cutover/tryoutAssets";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const TRYOUT_CATALOG_COUNT = 2;

describe("contentRelease/cutover/tryoutAssets", () => {
  it("stages exact authenticated try-out asset identities idempotently", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateTechnicalTryout(ctx);
      const rows = await ctx.db.query("tryoutCatalog").collect();
      for (const row of rows) {
        await ctx.db.patch("tryoutCatalog", row._id, { assetId: undefined });
      }
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(proveTryoutAssetIdsComplete(ctx, TRYOUT_CATALOG_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    const first = await t.mutation((ctx) =>
      runConvexProgram(stageTryoutAssetIds(ctx, TRYOUT_CATALOG_COUNT))
    );
    const second = await t.mutation((ctx) =>
      runConvexProgram(stageTryoutAssetIds(ctx, TRYOUT_CATALOG_COUNT))
    );
    const proved = await t.query((ctx) =>
      runConvexProgram(proveTryoutAssetIdsComplete(ctx, TRYOUT_CATALOG_COUNT))
    );
    const receipt = await t.mutation((ctx) =>
      runConvexProgram(checkpointTryoutAssetIds(ctx, TRYOUT_CATALOG_COUNT))
    );
    const indexed = await t.run(async (ctx) => {
      const row = await ctx.db.query("tryoutCatalog").first();
      const assetId = row?.assetId;
      const publicPath = row?.publicPath;
      if (!(row && assetId && publicPath)) {
        throw new Error("Expected one staged try-out reference identity.");
      }
      const asset = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_assetId", (index) =>
          index.eq("snapshotId", row.snapshotId).eq("assetId", assetId)
        )
        .unique();
      const route = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
          index
            .eq("snapshotId", row.snapshotId)
            .eq("locale", row.locale)
            .eq("publicPath", publicPath)
        )
        .unique();
      const checkpoint = await ctx.db.query("contentCutoverState").unique();
      return { asset, checkpoint, route, row };
    });

    expect(first).toEqual({
      complete: true,
      total: TRYOUT_CATALOG_COUNT,
      unchanged: 0,
      updated: TRYOUT_CATALOG_COUNT,
    });
    expect(second).toEqual({
      complete: true,
      total: TRYOUT_CATALOG_COUNT,
      unchanged: TRYOUT_CATALOG_COUNT,
      updated: 0,
    });
    expect(proved).toBe(TRYOUT_CATALOG_COUNT);
    expect(receipt.count).toBe(TRYOUT_CATALOG_COUNT);
    expect(indexed.checkpoint?.tryoutReferenceProof).toEqual(receipt);
    expect(indexed.asset?._id).toBe(indexed.row._id);
    expect(indexed.route?._id).toBe(indexed.row._id);
  });

  it("rejects a stored identity that differs from its signed try-out row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateTechnicalTryout(ctx);
      const row = await ctx.db.query("tryoutCatalog").first();
      if (!row) {
        throw new Error("Expected one try-out catalog row.");
      }
      await ctx.db.patch("tryoutCatalog", row._id, {
        assetId: "asset:en:tryout:technical:tampered",
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(stageTryoutAssetIds(ctx, TRYOUT_CATALOG_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects duplicate authenticated try-out asset identities", async () => {
    const first = makeTryoutCatalogRow("en").record.row;
    const second = makeTryoutCatalogRow("id").record.row;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateTryoutSnapshot(ctx, {
        catalog: [
          first,
          {
            ...second,
            graph: { ...second.graph, assetId: first.graph.assetId },
          },
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(proveTryoutAssetIdsComplete(ctx, TRYOUT_CATALOG_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

function activateTechnicalTryout(ctx: MutationCtx) {
  return activateTryoutSnapshot(ctx, {
    catalog: [
      makeTryoutCatalogRow("en").record.row,
      makeTryoutCatalogRow("id").record.row,
    ],
    placements: [
      makeTryoutPlacementRow("en").record.row,
      makeTryoutPlacementRow("id").record.row,
    ],
  });
}

async function insertQuiescentCheckpoint(ctx: MutationCtx) {
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: "release-test",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 2,
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
