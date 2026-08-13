import {
  QURAN_LOCALES,
  QURAN_SEARCH_COUNT,
  QURAN_SURAH_COUNT,
} from "@nakafa/aksara-contracts/quran/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  checkpointQuranReferencePage,
  QURAN_REFERENCE_PAGE_LIMIT,
  QURAN_REFERENCE_READ_CEILING,
} from "@repo/backend/convex/contentRelease/cutover/quranAssets";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/quranAssets", () => {
  it("reserves two full read-headroom blocks at enforced row ceilings", () => {
    expect(QURAN_REFERENCE_READ_CEILING).toBe(7_969_170);
    expect(QURAN_REFERENCE_READ_CEILING).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - 2 * TRANSACTION_READ_HEADROOM
    );
  });

  it("stages and proves the exact Quran inventory in bounded pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, makeCompleteQuranSearch());
      const rows = await ctx.db.query("quranSearch").collect();
      for (const row of rows) {
        await ctx.db.patch("quranSearch", row._id, {
          assetId: undefined,
          publicPath: undefined,
        });
      }
      await insertQuiescentCheckpoint(ctx);
    });

    const receipts = await completeQuranCheckpoint(t, QURAN_SEARCH_COUNT);
    const repeated = await t.mutation((ctx) =>
      runConvexProgram(checkpointQuranReferencePage(ctx, QURAN_SEARCH_COUNT))
    );
    const stored = await t.run(async (ctx) => ({
      checkpoint: await ctx.db.query("contentCutoverState").unique(),
      rows: await ctx.db.query("quranSearch").collect(),
    }));

    expect(receipts).toHaveLength(
      QURAN_SEARCH_COUNT / QURAN_REFERENCE_PAGE_LIMIT
    );
    expect(receipts[0]).toMatchObject({
      checked: QURAN_REFERENCE_PAGE_LIMIT,
      complete: false,
      processed: QURAN_REFERENCE_PAGE_LIMIT,
      staged: QURAN_REFERENCE_PAGE_LIMIT,
    });
    expect(receipts.at(-1)).toEqual({
      checked: QURAN_SEARCH_COUNT,
      complete: true,
      nextIndex: null,
      processed: QURAN_REFERENCE_PAGE_LIMIT,
      staged: QURAN_REFERENCE_PAGE_LIMIT,
    });
    expect(repeated).toEqual({
      checked: QURAN_SEARCH_COUNT,
      complete: true,
      nextIndex: null,
      processed: 0,
      staged: 0,
    });
    expect(stored.checkpoint?.quranReferenceProgress).toBeUndefined();
    expect(stored.checkpoint?.quranReferenceProof?.count).toBe(
      QURAN_SEARCH_COUNT
    );
    expect(
      stored.rows.every(
        ({ assetId, publicPath }) => assetId !== undefined && publicPath
      )
    ).toBe(true);
  });

  it("rejects a stored identity that differs from its signed Quran row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, makeCompleteQuranSearch());
      const row = await ctx.db.query("quranSearch").first();
      if (!row) {
        throw new Error("Expected one Quran search row.");
      }
      await ctx.db.patch("quranSearch", row._id, {
        assetId: "asset:en:quran:quran-surah:tampered",
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(checkpointQuranReferencePage(ctx, QURAN_SEARCH_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a stored route that differs from its signed Quran row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, makeCompleteQuranSearch());
      const row = await ctx.db.query("quranSearch").first();
      if (!row) {
        throw new Error("Expected one Quran search row.");
      }
      await ctx.db.patch("quranSearch", row._id, {
        publicPath: "quran/tampered",
      });
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(checkpointQuranReferencePage(ctx, QURAN_SEARCH_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects duplicate authenticated Quran asset identities", async () => {
    const rows = makeCompleteQuranSearch();
    const first = rows[0];
    const second = rows[1];
    if (!(first && second)) {
      throw new Error("Expected two Quran search rows.");
    }
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, [
        first,
        { ...second, graph: { ...second.graph, assetId: first.graph.assetId } },
        ...rows.slice(2),
      ]);
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(checkpointQuranReferencePage(ctx, QURAN_SEARCH_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

/** Builds the exact signed two-locale Quran search inventory. */
function makeCompleteQuranSearch() {
  return Array.from(
    { length: QURAN_SURAH_COUNT },
    (_, index) => index + 1
  ).flatMap((surahNumber) =>
    QURAN_LOCALES.map((locale) => makeQuranSearch(locale, surahNumber))
  );
}

async function completeQuranCheckpoint(
  target: TestConvex<typeof schema>,
  expectedCount: number
) {
  let receipt = await target.mutation((ctx) =>
    runConvexProgram(checkpointQuranReferencePage(ctx, expectedCount))
  );
  const receipts = [receipt];
  while (!receipt.complete) {
    receipt = await target.mutation((ctx) =>
      runConvexProgram(checkpointQuranReferencePage(ctx, expectedCount))
    );
    receipts.push(receipt);
  }
  return receipts;
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
