import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  persistReferenceProof,
  requireReferenceProofs,
} from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const expected = {
  article: 1,
  material: 2,
  materialTopic: 5,
  quran: 3,
  tryout: 4,
};

describe("contentRelease/cutover/referenceProofs", () => {
  it("accepts all isolated receipts while publication identity is unchanged", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertQuiescentPublication);

    const receipts = await t.mutation(async (ctx) => ({
      article: await runConvexProgram(
        persistReferenceProof(ctx, "article", 1, expected.article)
      ),
      material: await runConvexProgram(
        persistReferenceProof(ctx, "material", 2, expected.material)
      ),
      materialTopic: await runConvexProgram(
        persistReferenceProof(ctx, "materialTopic", 5, expected.materialTopic)
      ),
      quran: await runConvexProgram(
        persistReferenceProof(ctx, "quran", 3, expected.quran)
      ),
      tryout: await runConvexProgram(
        persistReferenceProof(ctx, "tryout", 4, expected.tryout)
      ),
    }));

    await expect(
      t.query((ctx) => runConvexProgram(requireReferenceProofs(ctx, expected)))
    ).resolves.toEqual(expected);
    expect(receipts.article.count).toBe(expected.article);
    expect(receipts.material.count).toBe(expected.material);
    expect(receipts.materialTopic.count).toBe(expected.materialTopic);
    expect(receipts.quran.count).toBe(expected.quran);
    expect(receipts.tryout.count).toBe(expected.tryout);
  });

  it("rejects a missing family receipt", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertQuiescentPublication);
    await t.mutation((ctx) =>
      runConvexProgram(
        persistReferenceProof(ctx, "article", 1, expected.article)
      )
    );

    await expect(
      t.query((ctx) => runConvexProgram(requireReferenceProofs(ctx, expected)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a changed publication identity after all proofs", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertQuiescentPublication);
    await t.mutation(async (ctx) => {
      await runConvexProgram(
        persistReferenceProof(ctx, "article", 1, expected.article)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "material", 2, expected.material)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "materialTopic", 5, expected.materialTopic)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "quran", 3, expected.quran)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "tryout", 4, expected.tryout)
      );
      const publication = await ctx.db.query("contentState").unique();
      if (!publication) {
        throw new Error("Expected one publication checkpoint.");
      }
      await ctx.db.patch("contentState", publication._id, { nextSequence: 3 });
    });

    await expect(
      t.query((ctx) => runConvexProgram(requireReferenceProofs(ctx, expected)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects an unfinished Quran proof cursor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertQuiescentPublication);
    await t.mutation(async (ctx) => {
      await runConvexProgram(
        persistReferenceProof(ctx, "article", 1, expected.article)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "material", 2, expected.material)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "materialTopic", 5, expected.materialTopic)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "quran", 3, expected.quran)
      );
      await runConvexProgram(
        persistReferenceProof(ctx, "tryout", 4, expected.tryout)
      );
      const checkpoint = await ctx.db.query("contentCutoverState").unique();
      if (!checkpoint) {
        throw new Error("Expected one cutover checkpoint.");
      }
      await ctx.db.patch("contentCutoverState", checkpoint._id, {
        quranReferenceProgress: {
          afterIndex: 1,
          checked: 1,
          snapshotId: "snapshot-test",
        },
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(requireReferenceProofs(ctx, expected)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

async function insertQuiescentPublication(ctx: MutationCtx) {
  await ctx.db.insert("contentState", {
    activeReleaseId: "release-test",
    activeSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: 1,
  });
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
