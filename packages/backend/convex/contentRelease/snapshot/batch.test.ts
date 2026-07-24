import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
  TEST_STAGE_SNAPSHOT,
  TEST_STAGE_SNAPSHOT_BATCH,
} from "@repo/backend/test/content-snapshot";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/snapshot/batch", () => {
  it("stores one complete batch and replays it without counter drift", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await stageProgramSnapshot(t, data);

    await expect(
      t.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 0,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: data.rowJson,
        snapshotId: data.snapshotId,
      })
    ).resolves.toEqual({
      batchIndex: 0,
      created: 0,
      family: "program",
      releaseId: TEST_RELEASE_ID,
      snapshotId: data.snapshotId,
      unchanged: 6,
    });
    const stored = await t.run(async (ctx) => ({
      batches: await ctx.db.query("snapshotBatches").collect(),
      release: await ctx.db.query("contentReleases").unique(),
      rows: await ctx.db.query("programRows").collect(),
    }));
    expect(stored.batches).toHaveLength(1);
    expect(stored.rows).toHaveLength(6);
    expect(stored.release).toMatchObject({
      stagedSnapshotBatches: 1,
      stagedSnapshotRows: 6,
    });
  });

  it("requires the signed manifest and contiguous family batches", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const missing = convexTest(schema, convexModules);
    await missing.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await expect(
      missing.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 0,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: data.rowJson,
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });

    const gap = convexTest(schema, convexModules);
    await gap.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await gap.mutation(TEST_STAGE_SNAPSHOT, {
      releaseId: TEST_RELEASE_ID,
      snapshotJson: data.manifestJson,
    });
    await expect(
      gap.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 1,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: data.rowJson,
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects changed retries, count overflow, and cross-family rows", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const [firstRow] = data.rowJson;
    if (!firstRow) {
      throw new Error("Expected one program snapshot row.");
    }
    const changed = convexTest(schema, convexModules);
    await stageProgramSnapshot(changed, data);
    await expect(
      changed.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 0,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: [...data.rowJson].reverse(),
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    await expect(
      changed.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 1,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: [firstRow],
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const wrongFamily = convexTest(schema, convexModules);
    await wrongFamily.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await expect(
      wrongFamily.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 0,
        family: "quran",
        releaseId: TEST_RELEASE_ID,
        rowJson: data.rowJson,
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects empty batches and releases that stopped staging", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const empty = convexTest(schema, convexModules);
    await empty.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await expect(
      empty.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 0,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: [],
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });

    const closed = convexTest(schema, convexModules);
    await closed.mutation((ctx) =>
      insertTestRelease(ctx, {
        snapshots: data.snapshots,
        status: "verifying",
      })
    );
    await expect(
      closed.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
        batchIndex: 0,
        family: "program",
        releaseId: TEST_RELEASE_ID,
        rowJson: data.rowJson,
        snapshotId: data.snapshotId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });
});
