import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import {
  deleteAbortRows,
  hasAbortResidue,
} from "@repo/backend/convex/contentRelease/abort/rows";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  ABORT_ITEM_COUNT,
  ABORT_RELEASE_ID,
  seedAbortRelease,
} from "@repo/backend/test/content/abort";
import { insertTestHead } from "@repo/backend/test/content/head";
import { TEST_DIGEST } from "@repo/backend/test/content/release";
import { convexTest } from "convex-test";

describe("bounded release row abort", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves directory identities created by another sequence and tolerates already-removed keys", async () => {
    const t = convexTest(schema, convexModules);
    const foreignKey = await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      const [foreign, removed] = await ctx.db.query("contentKeys").take(2);
      assert(foreign && removed);
      await ctx.db.patch("contentKeys", foreign._id, { createdSequence: 2 });
      await ctx.db.delete("contentKeys", removed._id);
      return foreign.contentKey;
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(deleteAbortRows(ctx, ABORT_RELEASE_ID, 1))
      )
    ).resolves.toBe(ABORT_ITEM_COUNT);
    await expect(
      t.query((ctx) => ctx.db.query("contentKeys").collect())
    ).resolves.toMatchObject([{ contentKey: foreignKey, createdSequence: 2 }]);
    await expect(
      t.query((ctx) => runConvexProgram(hasAbortResidue(ctx, 1)))
    ).resolves.toBe(false);
  });

  it("removes binding rows without claiming foreign or missing public paths", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentPaths", {
        appLocale: "en",
        publicPath: "test/foreign",
        createdSequence: 2,
      });
      for (const [index, publicPath] of [
        "test/foreign",
        "test/absent",
      ].entries()) {
        await ctx.db.insert("contentBindings", {
          appLocale: "en",
          batchHash: TEST_DIGEST,
          batchIndex: 0,
          index,
          operation: "delete",
          publicPath,
          releaseId: ABORT_RELEASE_ID,
          routeJson: "{}",
          sequence: 1,
        });
      }
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(deleteAbortRows(ctx, ABORT_RELEASE_ID, 1))
      )
    ).resolves.toBe(2);
    await expect(
      t.query((ctx) => ctx.db.query("contentPaths").collect())
    ).resolves.toMatchObject([
      { publicPath: "test/foreign", createdSequence: 2 },
    ]);
    await expect(
      t.query((ctx) => ctx.db.query("contentBindings").collect())
    ).resolves.toEqual([]);
  });

  it("deletes tombstone heads without inventing artifact ownership", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestHead(ctx, {
        contentKey: "test:tombstone",
        operation: "delete",
        releaseId: ABORT_RELEASE_ID,
      })
    );
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(deleteAbortRows(ctx, ABORT_RELEASE_ID, 1))
      )
    ).resolves.toBe(1);
    await expect(
      t.query((ctx) => ctx.db.query("contentHeads").collect())
    ).resolves.toEqual([]);
  });

  it("stops a snapshot batch page at measured write headroom and resumes the remaining rows", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let batchIndex = 0; batchIndex < 3; batchIndex += 1) {
        await ctx.db.insert("snapshotBatches", {
          batchHash: TEST_DIGEST,
          batchIndex,
          createdAt: 0,
          family: "program",
          firstIndex: batchIndex,
          releaseId: ABORT_RELEASE_ID,
          rowCount: 1,
          sequence: 1,
          snapshotId: TEST_DIGEST,
        });
      }
    });
    const first = await t.mutation(async (ctx) => {
      const metrics = await ctx.meta.getTransactionMetrics();
      const inspection = vi
        .spyOn(ctx.meta, "getTransactionMetrics")
        .mockResolvedValue({
          ...metrics,
          bytesWritten: { ...metrics.bytesWritten, remaining: 0 },
        });
      const processed = await runConvexProgram(
        deleteAbortRows(ctx, ABORT_RELEASE_ID, 1)
      );
      inspection.mockRestore();
      return processed;
    });
    expect(first).toBe(1);
    await expect(
      t.query((ctx) => ctx.db.query("snapshotBatches").collect())
    ).resolves.toHaveLength(2);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(deleteAbortRows(ctx, ABORT_RELEASE_ID, 1))
      )
    ).resolves.toBe(2);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(deleteAbortRows(ctx, ABORT_RELEASE_ID, 1))
      )
    ).resolves.toBe(0);
  });
});
