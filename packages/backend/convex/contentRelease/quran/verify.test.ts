import {
  QuranSearchRowSchema,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Loads the only technical Quran row inside one test transaction. */
async function loadRow(ctx: Pick<QueryCtx, "db">) {
  const row = await ctx.db.query("quranRows").unique();
  if (!row) {
    throw new Error("Expected one technical Quran row.");
  }
  return row;
}

describe("contentRelease/quran/verify", () => {
  it("rejects a changed signed identity", async () => {
    const signed = convexTest(schema, convexModules);
    const signedId = await signed.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSearch("en", 1)])
    );
    await signed.mutation(async (ctx) => {
      const row = await loadRow(ctx);
      await ctx.db.patch("quranRows", row._id, {
        rowHash: `sha256:${"9".repeat(64)}`,
      });
    });
    await expect(
      signed.query(async (ctx) => {
        const row = await loadRow(ctx);
        return runConvexProgram(
          verifyQuranRow(row, signedId, QuranSearchRowSchema)
        );
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a payload decoded through another Quran row contract", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSearch("en", 1)])
    );

    await expect(
      t.query(async (ctx) => {
        const row = await loadRow(ctx);
        return runConvexProgram(
          verifyQuranRow(row, snapshotId, QuranSurahRowSchema)
        );
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects indexed facts that drifted from the signed row", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSearch("en", 1)])
    );
    await t.mutation(async (ctx) => {
      const row = await loadRow(ctx);
      await ctx.db.patch("quranRows", row._id, { locale: "id" });
    });

    await expect(
      t.query(async (ctx) => {
        const row = await loadRow(ctx);
        return runConvexProgram(
          verifyQuranRow(row, snapshotId, QuranSearchRowSchema)
        );
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a replayed row above its aggregate transaction budget", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSearch("en", 1)])
    );
    await t.mutation(async (ctx) => {
      const row = await loadRow(ctx);
      await ctx.db.patch("quranRows", row._id, {
        identity: `search:en:1:${"x".repeat(QURAN_SEARCH_DOCUMENT_LIMIT)}`,
      });
    });

    await expect(
      t.query(async (ctx) => {
        const row = await loadRow(ctx);
        return runConvexProgram(
          verifyQuranRow(row, snapshotId, QuranSearchRowSchema)
        );
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });
  });
});
