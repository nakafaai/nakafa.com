import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT,
  MATERIAL_REFERENCE_PAGE_LIMIT,
  MATERIAL_STAGE_READ_CEILING,
  MATERIAL_STAGE_ROW_READ_LIMIT,
  stageMaterialTopicPage,
} from "@repo/backend/convex/contentRelease/cutover/materialTopics";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const PAGED_MATERIAL_COUNT = MATERIAL_REFERENCE_PAGE_LIMIT + 1;

describe("contentRelease/cutover/materialTopics", () => {
  it("keeps one page below the reserved transaction read budget", () => {
    expect(MATERIAL_STAGE_ROW_READ_LIMIT).toBe(
      MATERIAL_REFERENCE_PAGE_LIMIT +
        1 +
        MATERIAL_REFERENCE_PAGE_LIMIT *
          MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT
    );
    expect(MATERIAL_STAGE_READ_CEILING).toBe(262_144);
    expect(MATERIAL_STAGE_READ_CEILING).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("stages exact topic facts in bounded idempotent pages", async () => {
    const projections = Array.from(
      { length: PAGED_MATERIAL_COUNT },
      (_, index) => makeMaterialProjection("en", 1, index)
    );
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t, projections);
    await t.mutation(async (ctx) => {
      const rows = await ctx.db.query("materialCatalog").collect();
      for (const row of rows) {
        await ctx.db.patch("materialCatalog", row._id, {
          topicAssetId: undefined,
        });
      }
      await insertQuiescentCheckpoint(ctx);
    });

    const first = await t.mutation((ctx) =>
      runConvexProgram(stageMaterialTopicPage(ctx, PAGED_MATERIAL_COUNT))
    );
    const second = await t.mutation((ctx) =>
      runConvexProgram(stageMaterialTopicPage(ctx, PAGED_MATERIAL_COUNT))
    );
    const repeated = await t.mutation((ctx) =>
      runConvexProgram(stageMaterialTopicPage(ctx, PAGED_MATERIAL_COUNT))
    );
    const stored = await t.run(async (ctx) => ({
      checkpoint: await ctx.db.query("contentCutoverState").unique(),
      rows: await ctx.db.query("materialCatalog").collect(),
    }));

    expect(first).toMatchObject({
      checked: MATERIAL_REFERENCE_PAGE_LIMIT,
      complete: false,
      processed: MATERIAL_REFERENCE_PAGE_LIMIT,
      staged: MATERIAL_REFERENCE_PAGE_LIMIT,
    });
    expect(second).toEqual({
      checked: PAGED_MATERIAL_COUNT,
      complete: true,
      processed: 1,
      staged: 1,
    });
    expect(repeated).toEqual({
      checked: PAGED_MATERIAL_COUNT,
      complete: true,
      processed: 0,
      staged: 0,
    });
    expect(stored.checkpoint?.materialReferenceProgress).toMatchObject({
      checked: 0,
      phase: "prove",
      topics: 0,
    });
    expect(stored.rows.every((row) => row.topicAssetId !== undefined)).toBe(
      true
    );
  });

  it("rejects a stored topic identity that differs from signed facts", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t, [makeMaterialProjection("en", 1)]);
    await t.mutation(async (ctx) => {
      const row = await ctx.db.query("materialCatalog").unique();
      if (!row) {
        throw new Error("Expected one material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        topicAssetId: "asset:en:material:lesson:tampered",
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(stageMaterialTopicPage(ctx, 1)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

async function insertQuiescentCheckpoint(ctx: MutationCtx) {
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
    auditedActiveSequence: MATERIAL_IDENTITY.sequence,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: MATERIAL_IDENTITY.sequence + 1,
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
