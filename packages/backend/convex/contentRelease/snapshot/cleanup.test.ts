import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { compactSnapshots } from "@repo/backend/convex/contentRelease/snapshot/cleanup";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeProgramSnapshotData } from "@repo/backend/test/content-snapshot";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Inserts one expired manifest and a requested number of physical rows. */
async function insertExpiredProgram(
  ctx: MutationCtx,
  snapshotId: string,
  rowCount: number,
  cleanupAt?: number
) {
  await ctx.db.insert("contentSnapshots", {
    ...(cleanupAt === undefined ? {} : { cleanupAt }),
    createdAt: 0,
    family: "program",
    retainUntil: 0,
    snapshotId,
    snapshotJson: "{}",
  });
  for (let index = 0; index < rowCount; index += 1) {
    await ctx.db.insert("programRows", {
      index,
      programKey: `technical-${index}`,
      rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      rowJson: "{}",
      snapshotId,
    });
  }
}

describe("contentRelease/snapshot/cleanup", () => {
  it("ignores unexpired snapshots without a cleanup retry", async () => {
    const snapshotId = `sha256:${"6".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      ctx.db.insert("contentSnapshots", {
        createdAt: 0,
        family: "program",
        retainUntil: 1,
        snapshotId,
        snapshotJson: "{}",
      })
    );

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: true });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ snapshotId });
  });

  it("deletes expired snapshots through resumable bounded pages", async () => {
    const snapshotId = `sha256:${"7".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertExpiredProgram(ctx, snapshotId, 33));

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 32, done: false });
    await expect(
      t.run(async (ctx) => ({
        rows: await ctx.db.query("programRows").collect(),
        snapshot: await ctx.db.query("contentSnapshots").unique(),
      }))
    ).resolves.toMatchObject({
      rows: [{ index: 32 }],
      snapshot: { cleanupAt: 0, cleanupIndex: 31, cleanupRetryAt: 0 },
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: true });
  });

  it("extends retained snapshots selected by protected release history", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await t.mutation((ctx) => insertExpiredProgram(ctx, data.snapshotId, 0));

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: false });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ retainUntil: expect.any(Number) });
  });

  it("fails closed when a partially cleaned snapshot becomes referenced", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await t.mutation((ctx) => insertExpiredProgram(ctx, data.snapshotId, 0, 0));

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
