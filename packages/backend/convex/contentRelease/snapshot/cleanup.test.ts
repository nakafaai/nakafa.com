import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { compactSnapshots } from "@repo/backend/convex/contentRelease/snapshot/cleanup";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program-snapshot";
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
    await ctx.db.insert("programCatalog", {
      displayOrder: index,
      index,
      programKey: `program-${index}`,
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
    await t.mutation(async (ctx) => {
      await insertExpiredProgram(ctx, snapshotId, 3);
      await ctx.db.insert("curriculumRoutes", {
        index: 3,
        level: "track",
        locale: "en",
        nodeKey: "program-0:root",
        order: 0,
        programKey: "program-0",
        path: "curriculum/program-0",
        rowHash: `sha256:${"3".padStart(64, "0")}`,
        rowJson: "{}",
        snapshotId,
        sourcePath: "packages/corpus/curriculum/program-0",
      });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.run(async (ctx) => ({
        curriculum: await ctx.db.query("curriculumRoutes").collect(),
        programs: await ctx.db.query("programCatalog").collect(),
        snapshot: await ctx.db.query("contentSnapshots").unique(),
      }))
    ).resolves.toMatchObject({
      curriculum: [{ index: 3 }],
      programs: [{ index: 2 }],
      snapshot: {
        cleanupAt: 0,
        cleanupIndex: 1,
        cleanupPart: "program",
        cleanupRetryAt: 0,
      },
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: true });
  });

  it("keeps near-limit snapshot bodies inside one bounded transaction", async () => {
    const snapshotId = `sha256:${"8".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertExpiredProgram(ctx, snapshotId, 0);
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("programCatalog", {
          displayOrder: index,
          index,
          programKey: `program-${index}`,
          rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          rowJson: "x".repeat(450_000),
          snapshotId,
        });
      }
    });

    const first = await t.mutation((ctx) =>
      runConvexProgram(compactSnapshots(ctx, 0))
    );
    const pending = await t.run(async (ctx) => ({
      rows: await ctx.db.query("programCatalog").take(3),
      snapshot: await ctx.db.query("contentSnapshots").unique(),
    }));
    expect(first).toEqual({ cursor: null, deleted: 2, done: false });
    expect(pending.rows).toHaveLength(1);
    expect(pending.snapshot).toMatchObject({ cleanupIndex: 1 });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
  });

  it("cleans try-out tables in separate durable physical phases", async () => {
    const snapshotId = `sha256:${"9".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSnapshots", {
        createdAt: 0,
        family: "tryout",
        retainUntil: 0,
        snapshotId,
        snapshotJson: "{}",
      });
      for (const index of [0]) {
        await ctx.db.insert("tryoutCatalog", {
          identity: `catalog-${index}`,
          index,
          kind: "exam",
          locale: "en",
          order: index,
          rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          rowJson: "{}",
          snapshotId,
        });
      }
      for (const index of [1]) {
        await ctx.db.insert("tryoutPlacements", {
          answerArtifactHash: `sha256:${"a".repeat(64)}`,
          identity: `placement-${index}`,
          index,
          locale: "en",
          questionArtifactHash: `sha256:${"b".repeat(64)}`,
          questionOrder: index,
          rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          rowJson: "{}",
          snapshotId,
        });
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ cleanupPart: "placement" });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.run(async (ctx) => ({
        catalog: await ctx.db.query("tryoutCatalog").take(1),
        placement: await ctx.db.query("tryoutPlacements").take(1),
      }))
    ).resolves.toEqual({ catalog: [], placement: [] });
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
