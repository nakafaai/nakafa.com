import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  checkpointMaterialReferencePage,
  MATERIAL_PROOF_READ_CEILING,
  MATERIAL_PROOF_ROW_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/cutover/materialAssets";
import {
  MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT,
  MATERIAL_REFERENCE_DOCUMENT_READ_CEILING,
  MATERIAL_REFERENCE_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/cutover/materialTopics";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import type { TestIdentity } from "@repo/backend/test/content-state";
import {
  activateInheritedMaterialCatalog,
  activateMaterialCatalog,
  INHERITED_MATERIAL_IDENTITY,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const MATERIAL_COUNT = 4;
const TOPIC_COUNT = 2;

describe("contentRelease/cutover/materialAssets", () => {
  it("keeps one proof page below the reserved transaction read budget", () => {
    expect(MATERIAL_PROOF_ROW_READ_LIMIT).toBe(
      MATERIAL_REFERENCE_PAGE_LIMIT *
        (6 + MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT)
    );
    expect(MATERIAL_PROOF_READ_CEILING).toBe(
      MATERIAL_REFERENCE_PAGE_LIMIT *
        (6 + MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT) *
        MATERIAL_REFERENCE_DOCUMENT_READ_CEILING
    );
    expect(MATERIAL_PROOF_READ_CEILING).toBe(491_520);
    expect(MATERIAL_PROOF_READ_CEILING).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("proves exact lesson and topic references in durable pages", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);
    await t.mutation(insertQuiescentCheckpoint);

    const receipts = await completeCheckpoint(t, MATERIAL_COUNT, TOPIC_COUNT);
    const repeated = await t.mutation((ctx) =>
      runConvexProgram(
        checkpointMaterialReferencePage(ctx, MATERIAL_COUNT, TOPIC_COUNT)
      )
    );
    const indexed = await t.run(async (ctx) => {
      const row = await ctx.db.query("materialCatalog").first();
      if (!row?.topicAssetId) {
        throw new Error("Expected one material catalog topic.");
      }
      const topic = await ctx.db
        .query("materialCatalog")
        .withIndex("by_topicAssetId_and_assetId", (index) =>
          index.eq("topicAssetId", row.topicAssetId)
        )
        .first();
      const checkpoint = await ctx.db.query("contentCutoverState").unique();
      return { checkpoint, row, topic };
    });

    expect(receipts).toEqual([
      {
        checked: MATERIAL_REFERENCE_PAGE_LIMIT,
        complete: false,
        phase: "stage",
        processed: MATERIAL_REFERENCE_PAGE_LIMIT,
        staged: 0,
        topics: 0,
      },
      {
        checked: MATERIAL_COUNT,
        complete: false,
        phase: "stage",
        processed: 1,
        staged: 0,
        topics: 0,
      },
      {
        checked: MATERIAL_REFERENCE_PAGE_LIMIT,
        complete: false,
        phase: "prove",
        processed: MATERIAL_REFERENCE_PAGE_LIMIT,
        staged: 0,
        topics: TOPIC_COUNT,
      },
      {
        checked: MATERIAL_COUNT,
        complete: true,
        phase: "complete",
        processed: 1,
        staged: 0,
        topics: TOPIC_COUNT,
      },
    ]);
    expect(repeated).toEqual({
      checked: MATERIAL_COUNT,
      complete: true,
      phase: "complete",
      processed: 0,
      staged: 0,
      topics: TOPIC_COUNT,
    });
    expect(indexed.checkpoint?.materialReferenceProgress).toBeUndefined();
    expect(indexed.checkpoint?.materialReferenceProof?.count).toBe(
      MATERIAL_COUNT
    );
    expect(indexed.checkpoint?.materialTopicReferenceProof?.count).toBe(
      TOPIC_COUNT
    );
    expect(indexed.topic?.topicAssetId).toBe(indexed.row.topicAssetId);
  });

  it("proves inherited rows from two generations at the effective active sequence", async () => {
    const t = convexTest(schema, convexModules);
    await activateInheritedMaterialCatalog(t);
    await t.mutation((ctx) =>
      insertQuiescentCheckpointFor(ctx, INHERITED_MATERIAL_IDENTITY)
    );

    const first = await t.mutation((ctx) =>
      runConvexProgram(
        checkpointMaterialReferencePage(ctx, MATERIAL_COUNT, TOPIC_COUNT)
      )
    );
    const progress = await t.run((ctx) =>
      ctx.db.query("contentCutoverState").unique()
    );
    const receipts = [
      first,
      ...(await completeCheckpoint(t, MATERIAL_COUNT, TOPIC_COUNT)),
    ];
    const rows = await t.run((ctx) =>
      ctx.db.query("materialCatalog").take(MATERIAL_COUNT)
    );

    expect(first).toMatchObject({
      checked: MATERIAL_REFERENCE_PAGE_LIMIT,
      complete: false,
      phase: "stage",
    });
    expect(progress?.materialReferenceProgress).toMatchObject({
      checked: MATERIAL_REFERENCE_PAGE_LIMIT,
      phase: "stage",
    });
    expect(receipts.at(-1)).toMatchObject({
      checked: MATERIAL_COUNT,
      complete: true,
      phase: "complete",
      topics: TOPIC_COUNT,
    });
    expect(new Set(rows.map((row) => row.sequence))).toEqual(new Set([1, 2]));
    expect(
      rows.every((row) => row.sequence < INHERITED_MATERIAL_IDENTITY.sequence)
    ).toBe(true);
  });

  it("rejects duplicate authenticated lesson identities", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t, [makeMaterialProjection("en", 1)]);
    await t.mutation(async (ctx) => {
      const material = await ctx.db.query("materialCatalog").unique();
      if (!material) {
        throw new Error("Expected one material catalog row.");
      }
      const { _creationTime: _, _id: __, ...duplicate } = material;
      await ctx.db.insert("materialCatalog", duplicate);
      await insertQuiescentCheckpoint(ctx);
    });
    await t.mutation((ctx) =>
      runConvexProgram(checkpointMaterialReferencePage(ctx, 2, 1))
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(checkpointMaterialReferencePage(ctx, 2, 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects conflicting signed facts for one topic identity", async () => {
    const first = makeMaterialProjection("en", 1);
    const second = {
      ...makeMaterialProjection("en", 2),
      topicTitle: "Conflicting Topic",
    };
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t, [first, second]);
    await t.mutation(insertQuiescentCheckpoint);
    await t.mutation((ctx) =>
      runConvexProgram(checkpointMaterialReferencePage(ctx, 2, 1))
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(checkpointMaterialReferencePage(ctx, 2, 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a material outside the audited release", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t, [makeMaterialProjection("en", 1)]);
    await t.mutation(async (ctx) => {
      const material = await ctx.db.query("materialCatalog").unique();
      if (!material) {
        throw new Error("Expected one material catalog row.");
      }
      await ctx.db.patch("materialCatalog", material._id, {
        releaseId: "release-stale",
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(checkpointMaterialReferencePage(ctx, 1, 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

async function completeCheckpoint(
  target: TestConvex<typeof schema>,
  expectedCount: number,
  expectedTopicCount: number
) {
  const first = await target.mutation((ctx) =>
    runConvexProgram(
      checkpointMaterialReferencePage(ctx, expectedCount, expectedTopicCount)
    )
  );
  const receipts = [first];
  if (first.complete) {
    return receipts;
  }
  for (let page = 1; page < 10; page += 1) {
    const receipt = await target.mutation((ctx) =>
      runConvexProgram(
        checkpointMaterialReferencePage(ctx, expectedCount, expectedTopicCount)
      )
    );
    receipts.push(receipt);
    if (receipt.complete) {
      return receipts;
    }
  }
  throw new Error("Material reference checkpoint did not complete.");
}

async function insertQuiescentCheckpoint(ctx: MutationCtx) {
  await insertQuiescentCheckpointFor(ctx, MATERIAL_IDENTITY);
}

async function insertQuiescentCheckpointFor(
  ctx: MutationCtx,
  identity: TestIdentity
) {
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: identity.releaseId,
    auditedActiveSequence: identity.sequence,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: identity.sequence + 1,
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
