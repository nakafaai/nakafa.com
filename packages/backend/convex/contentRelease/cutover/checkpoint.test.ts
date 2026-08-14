import { retireCutoverCheckpoint } from "@repo/backend/convex/contentRelease/cutover/checkpoint";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  CUTOVER_GENESIS,
  insertAcceptedGenesisPublication,
  insertProvedCutoverInventory,
} from "@repo/backend/test/content-cutover";
import { testReleaseJson } from "@repo/backend/test/content-release";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const GENESIS_IDENTITY = {
  activeManifestHash: CUTOVER_GENESIS.manifestHash,
  activeReleaseId: CUTOVER_GENESIS.releaseId,
};
const retire = (ctx: Parameters<typeof retireCutoverCheckpoint>[0]) =>
  runConvexProgram(retireCutoverCheckpoint(ctx, GENESIS_IDENTITY));

async function seedReady(
  ctx: Parameters<typeof insertProvedCutoverInventory>[0]
) {
  await insertProvedCutoverInventory(ctx);
  await insertAcceptedGenesisPublication(ctx);
}

describe("contentRelease/cutover/checkpoint", () => {
  it("deletes both proved rows atomically and retries from exact current state", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedReady);

    const first = await t.mutation(retire);
    const replayed = await t.mutation(retire);
    const rows = await t.run(async (ctx) => ({
      activity: await ctx.db.query("contentCutoverActivity").collect(),
      state: await ctx.db.query("contentCutoverState").collect(),
    }));

    expect(first).toEqual({
      ...GENESIS_IDENTITY,
      activityDeleted: 1,
      attempts: 21,
      checkpointDeleted: 1,
      placements: 1720,
      progress: 10,
    });
    expect(replayed).toEqual({
      ...first,
      activityDeleted: 0,
      checkpointDeleted: 0,
    });
    expect(rows).toEqual({ activity: [], state: [] });
  });

  it("rejects a non-genesis active release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedReady(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected genesis release fixture.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        releaseJson: testReleaseJson({
          baseManifestHash: `sha256:${"9".repeat(64)}`,
          baseReleaseId: "release-old",
          manifestHash: CUTOVER_GENESIS.manifestHash,
          releaseId: CUTOVER_GENESIS.releaseId,
        }),
      });
    });

    await expect(t.mutation(retire)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("six-scope genesis"),
      },
    });
  });

  it("rejects an unsynchronized read-model slot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedReady(ctx);
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state fixture.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchReleaseId: "release-stale",
      });
    });

    await expect(t.mutation(retire)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("accepted genesis identity"),
      },
    });
  });

  it("rejects a missing reader receipt without deleting either row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedReady(ctx);
      const state = await ctx.db.query("contentCutoverState").unique();
      if (!state) {
        throw new Error("Expected cutover state fixture.");
      }
      await ctx.db.patch("contentCutoverState", state._id, {
        readerCutoverReceipt: undefined,
      });
    });

    await expect(t.mutation(retire)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("exact terminal proof"),
      },
    });
    await expect(t.run(readCheckpointRows)).resolves.toMatchObject({
      activity: { key: "legacy" },
      state: { key: "phase1" },
    });
  });

  it("rejects tampered terminal evidence without deleting either row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedReady(ctx);
      const state = await ctx.db.query("contentCutoverState").unique();
      if (!state?.audioWorkflowAudit) {
        throw new Error("Expected cutover audio receipt fixture.");
      }
      await ctx.db.patch("contentCutoverState", state._id, {
        audioWorkflowAudit: {
          ...state.audioWorkflowAudit,
          succeeded: state.audioWorkflowAudit.succeeded - 1,
        },
      });
    });

    await expect(t.mutation(retire)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("exact terminal proof"),
      },
    });
    await expect(t.run(readCheckpointRows)).resolves.toMatchObject({
      activity: { key: "legacy" },
      state: { key: "phase1" },
    });
  });

  it("rejects a self-consistent wrong reference count", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedReady(ctx);
      const state = await ctx.db.query("contentCutoverState").unique();
      if (!state?.readerCutoverReceipt) {
        throw new Error("Expected cutover reader receipt fixture.");
      }
      await ctx.db.patch("contentCutoverState", state._id, {
        articleReferenceProof: { count: 1, provedAt: 2 },
        readerCutoverReceipt: {
          ...state.readerCutoverReceipt,
          referenceProofs: {
            ...state.readerCutoverReceipt.referenceProofs,
            article: 1,
          },
        },
      });
    });

    await expect(t.mutation(retire)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("exact terminal proof"),
      },
    });
    await expect(t.run(readCheckpointRows)).resolves.toMatchObject({
      activity: { key: "legacy" },
      state: { key: "phase1" },
    });
  });

  it("rejects a partial checkpoint without deleting the survivor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedReady(ctx);
      const activity = await ctx.db.query("contentCutoverActivity").unique();
      if (!activity) {
        throw new Error("Expected cutover activity fixture.");
      }
      await ctx.db.delete(activity._id);
    });

    await expect(t.mutation(retire)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("partially present"),
      },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentCutoverState").unique())
    ).resolves.toMatchObject({ key: "phase1" });
  });
});

async function readCheckpointRows(
  ctx: Parameters<typeof retireCutoverCheckpoint>[0]
) {
  const [activity, state] = await Promise.all([
    ctx.db.query("contentCutoverActivity").unique(),
    ctx.db.query("contentCutoverState").unique(),
  ]);
  return { activity, state };
}
