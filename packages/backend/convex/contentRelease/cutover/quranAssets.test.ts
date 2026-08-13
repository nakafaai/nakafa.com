import {
  QURAN_LOCALES,
  QURAN_SEARCH_COUNT,
  QURAN_SURAH_COUNT,
} from "@nakafa/aksara-contracts/quran/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  proveQuranAssetIdsComplete,
  stageQuranAssetIds,
} from "@repo/backend/convex/contentRelease/cutover/quranAssets";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/quranAssets", () => {
  it("stages exact authenticated Quran asset identities idempotently", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateQuranSnapshot(ctx, makeCompleteQuranSearch());
      const rows = await ctx.db.query("quranSearch").collect();
      for (const row of rows) {
        await ctx.db.patch("quranSearch", row._id, { assetId: undefined });
      }
      await insertQuiescentCheckpoint(ctx);
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(proveQuranAssetIdsComplete(ctx, QURAN_SEARCH_COUNT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    const first = await t.mutation((ctx) =>
      runConvexProgram(stageQuranAssetIds(ctx, QURAN_SEARCH_COUNT))
    );
    const second = await t.mutation((ctx) =>
      runConvexProgram(stageQuranAssetIds(ctx, QURAN_SEARCH_COUNT))
    );
    const proved = await t.query((ctx) =>
      runConvexProgram(proveQuranAssetIdsComplete(ctx, QURAN_SEARCH_COUNT))
    );
    const indexed = await t.run(async (ctx) => {
      const row = await ctx.db.query("quranSearch").first();
      if (!row?.assetId) {
        throw new Error("Expected one staged Quran asset identity.");
      }
      return ctx.db
        .query("quranSearch")
        .withIndex("by_snapshotId_and_locale_and_assetId", (index) =>
          index
            .eq("snapshotId", row.snapshotId)
            .eq("locale", row.locale)
            .eq("assetId", row.assetId)
        )
        .unique();
    });

    expect(first).toEqual({
      complete: true,
      total: QURAN_SEARCH_COUNT,
      unchanged: 0,
      updated: QURAN_SEARCH_COUNT,
    });
    expect(second).toEqual({
      complete: true,
      total: QURAN_SEARCH_COUNT,
      unchanged: QURAN_SEARCH_COUNT,
      updated: 0,
    });
    expect(proved).toBe(QURAN_SEARCH_COUNT);
    expect(indexed?.assetId).toBeDefined();
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
        runConvexProgram(stageQuranAssetIds(ctx, QURAN_SEARCH_COUNT))
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
