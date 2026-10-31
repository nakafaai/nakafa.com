import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { actionLayer } from "@confect/server/RegisteredFunction";

import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  compactProgram,
  runProgram,
} from "@repo/backend/confect/contentRelease/compact";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  COMPACTION_OLD_TIME,
  compactionIdentity,
  insertCompaction,
  insertCompletedRelease,
  seedCompactionHistory,
  seedExpiredSnapshotBacklog,
} from "@repo/backend/test/content/compact";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr, DateTime, Effect, Option, Order } from "effect";

const IDLE_RELEASE_COUNT = 40;

/** Runs one scheduled compaction tick in an action of the test deployment. */
function runCompaction(t: TestConvex<typeof schema>) {
  return t.action((ctx) =>
    Effect.runPromise(
      runProgram().pipe(Effect.provide(actionLayer(confectSchema, ctx)))
    )
  );
}

describe("contentRelease/compact", () => {
  it("yields a large expired snapshot backlog across bounded scheduled runs", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedExpiredSnapshotBacklog);
    const paused = await t.action(internal.contentRelease.compact.run, {});
    expect(paused).toMatchObject({
      complete: false,
      floor: 1,
      phase: "snapshots",
    });
    const remaining = await t.query((ctx) =>
      ctx.db.query("contentSnapshots").collect()
    );
    expect(remaining.length).toBeGreaterThan(0);
    expect(remaining.length).toBeLessThan(70);
    let completed = false;
    for (let run = 0; run < 4; run += 1) {
      if ((await t.action(internal.contentRelease.compact.run, {})).complete) {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);
    expect(
      await t.query((ctx) => ctx.db.query("contentSnapshots").collect())
    ).toEqual([]);
    expect(
      await t.query((ctx) => ctx.db.query("contentCompaction").unique())
    ).toMatchObject({
      compactedFloor: 1,
    });
  });
  it("resumes pages and preserves floor anchors before collecting history", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedCompactionHistory(ctx);
      await ctx.db.insert("contentIndex", {
        contentKey: "test:compact-0",
        family: "material",
        appLocale: "en",
        projectionHash: `sha256:${"4".repeat(64)}`,
        publicPath: "test/compact-0",
        releaseId: "release-compact-4",
        sequence: 4,
        slot: "blue",
        text: "active search entry",
      });
    });
    const stateBefore = await t.run((ctx) =>
      ctx.db.query("contentState").unique()
    );
    const first = await t.mutation((ctx) =>
      Effect.runPromise(
        compactProgram().pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
      )
    );
    const paused = await t.run((ctx) =>
      ctx.db.query("contentCompaction").unique()
    );
    expect(first).toMatchObject({
      complete: false,
      floor: 3,
      phase: "heads",
    });
    expect(paused?.compactCursor).toBeUndefined();
    expect(paused?.compactPhase).toBe("heads");
    expect(paused?.compactedFloor).toBe(0);
    const completed = await runCompaction(t);
    const stored = await t.run(async (ctx) => ({
      artifacts: await ctx.db.query("contentArtifacts").collect(),
      bindings: await ctx.db.query("contentBindings").collect(),
      facts: await ctx.db.query("contentArtifactFacts").collect(),
      heads: await ctx.db.query("contentHeads").collect(),
      items: await ctx.db.query("contentItems").collect(),
      search: await ctx.db.query("contentIndex").collect(),
      releases: await ctx.db.query("contentReleases").collect(),
      compaction: await ctx.db.query("contentCompaction").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(completed).toMatchObject({
      complete: true,
      floor: 3,
    });
    expect(stored.heads).toHaveLength(82);
    expect(
      Option.getOrUndefined(
        Arr.findFirst(stored.heads, (row) => row.contentKey === "test:anchor")
      )
    ).toMatchObject({
      sequence: 3,
    });
    expect(
      Arr.sort(
        Arr.map(stored.bindings, (row) => row.sequence),
        Order.Number
      )
    ).toEqual([1, 3, 4]);
    expect(stored.items).toHaveLength(0);
    expect(stored.search).toMatchObject([
      {
        contentKey: "test:compact-0",
        sequence: 4,
      },
    ]);
    expect(
      Arr.sort(
        Arr.map(stored.releases, (row) => row.sequence),
        Order.Number
      )
    ).toEqual([3, 4, 5]);
    const retained = [
      `sha256:${"c".repeat(64)}`,
      `sha256:${"d".repeat(64)}`,
      `sha256:${"f".repeat(64)}`,
    ];
    expect(
      Arr.sort(
        Arr.map(stored.artifacts, (row) => row.artifactHash),
        Order.String
      )
    ).toEqual(retained);
    expect(
      Arr.sort(
        Arr.map(stored.facts, (row) => row.artifactHash),
        Order.String
      )
    ).toEqual(retained);
    expect(
      Option.getOrUndefined(
        Arr.findFirst(
          stored.facts,
          ({ artifactHash }) => artifactHash === `sha256:${"c".repeat(64)}`
        )
      )?.retainUntil
    ).toBeGreaterThan(DateTime.toEpochMillis(DateTime.nowUnsafe()));
    expect(stored.compaction).toMatchObject({
      compactedFloor: 3,
    });
    expect(stored.compaction?.compactPhase).toBeUndefined();
    // Every page of the cycle wrote the compaction row; the state row that
    // every content query loads was never written.
    expect(stored.state).toEqual(stateBefore);
    await expect(runCompaction(t)).resolves.toEqual({
      complete: true,
      deleted: 0,
      floor: 3,
      phase: "releases",
    });
  });
  it("stops before a recent unreachable release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const releases = Array.from(
        {
          length: 5,
        },
        (_, index) => compactionIdentity(index + 1)
      );
      const indexedReleases = Arr.map(releases, (release, index) => ({
        index,
        release,
      }));
      for (const { index, release } of indexedReleases) {
        await insertCompletedRelease(
          ctx,
          release,
          releases[index - 1],
          index === 1
            ? DateTime.toEpochMillis(DateTime.nowUnsafe())
            : COMPACTION_OLD_TIME
        );
      }
      const fifth = releases[4];
      if (!fifth) {
        throw new Error("Expected recent compaction releases.");
      }
      await insertTestState(ctx, {
        active: fifth,
        nextSequence: 6,
      });
    });
    const receipt = await runCompaction(t);
    const sequences = await t.run(async (ctx) =>
      Arr.map(
        await ctx.db.query("contentReleases").collect(),
        (release) => release.sequence
      )
    );
    expect(receipt).toMatchObject({
      complete: true,
      floor: 2,
    });
    expect(Arr.sort(sequences, Order.Number)).toEqual([2, 3, 4, 5]);
  });
  it("protects exact active bases and retained recovery slots", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const first = compactionIdentity(1);
      const base = compactionIdentity(2);
      const fourth = compactionIdentity(4);
      const active = compactionIdentity(5);
      const candidate = compactionIdentity(6);
      const recovery = compactionIdentity(7);
      await insertCompletedRelease(ctx, first);
      await insertCompletedRelease(ctx, base, first);
      await insertCompletedRelease(ctx, fourth, base);
      await insertCompletedRelease(ctx, active, base);
      await insertZeroRelease(ctx, {
        ...candidate,
        base: active,
        ownership: {
          base: ["material"],
          result: ["material"],
        },
        role: "candidate",
        status: "verified",
      });
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
        ownership: {
          base: ["material"],
          result: ["material"],
        },
        role: "recovery",
        status: "verified",
      });
      await insertTestState(ctx, {
        active,
        candidate,
        nextSequence: 8,
        recovery,
      });
    });
    const receipt = await runCompaction(t);
    const sequences = await t.run(async (ctx) =>
      Arr.map(
        await ctx.db.query("contentReleases").collect(),
        (release) => release.sequence
      )
    );
    expect(receipt).toMatchObject({
      complete: true,
      floor: 2,
    });
    expect(Arr.sort(sequences, Order.Number)).toEqual([2, 4, 5, 6, 7]);
  });
  it("reads two documents and writes nothing on an idle tick", async () => {
    const t = convexTest(schema, convexModules);
    const retained = Arr.makeBy(IDLE_RELEASE_COUNT, (index) =>
      compactionIdentity(index + 1)
    );
    await t.mutation(async (ctx) => {
      for (const [index, release] of Arr.map(
        retained,
        (identity, position) => [position, identity] as const
      )) {
        await insertCompletedRelease(
          ctx,
          release,
          retained[index - 1],
          DateTime.toEpochMillis(DateTime.nowUnsafe())
        );
      }
      await insertTestState(ctx, {
        active: retained[IDLE_RELEASE_COUNT - 1],
        nextSequence: IDLE_RELEASE_COUNT + 1,
      });
      await insertCompaction(ctx, { compactedFloor: 1 });
    });
    const before = await t.run((ctx) => ctx.db.query("contentState").unique());

    const tick = await t.mutation(async (ctx) => ({
      receipt: await ctx.runMutation(internal.contentRelease.compact.page, {}),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));

    expect(tick.receipt).toMatchObject({ complete: true, floor: 1 });
    // The compaction row and the oldest release. Before the compaction row
    // moved out of the state row and gated the scan, the same tick read 40
    // documents (185588 bytes): the state row, the protected slots with their
    // bases, and a 33 release scan, to conclude that nothing was due.
    expect(tick.metrics.documentsRead.used).toBe(2);
    expect(tick.metrics.documentsWritten.used).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("contentState").unique())).toEqual(
      before
    );
  });
});
describe("contentRelease/compact permanent history", () => {
  it.effect(
    "keeps the assessment snapshot an attempt names after its source release expires",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* world.start();
        const { snapshotId, t } = world;
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const source = await ctx.db.query("contentReleases").unique();
            assert.ok(source);
            await ctx.db.patch("contentReleases", source._id, { createdAt: 0 });
            let active: TestIdentity = {
              manifestHash: TEST_MANIFEST_HASH,
              releaseId: TEST_RELEASE_ID,
              sequence: source.sequence,
            };
            for (let sequence = 2; sequence <= 5; sequence += 1) {
              const identity = compactionIdentity(sequence);
              await insertCompletedRelease(ctx, identity, active, 0);
              active = identity;
            }
            const state = await ctx.db.query("contentState").unique();
            assert.ok(state);
            await ctx.db.patch("contentState", state._id, {
              activeManifestHash: active.manifestHash,
              activeReleaseId: active.releaseId,
              activeSequence: active.sequence,
              nextSequence: 6,
            });
            await insertCompaction(ctx, { compactedFloor: 1 });
            const snapshot = await ctx.db.query("contentSnapshots").unique();
            assert.ok(snapshot);
            await ctx.db.patch("contentSnapshots", snapshot._id, {
              retainUntil: 0,
            });
          })
        );
        const rows = () =>
          t.query((ctx) =>
            ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_index", (index) =>
                index.eq("snapshotId", snapshotId)
              )
              .collect()
          );
        const before = yield* Effect.promise(rows);
        expect(yield* Effect.promise(() => runCompaction(t))).toMatchObject({
          complete: true,
          floor: 3,
        });
        expect(yield* Effect.promise(rows)).toEqual(before);
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) => ctx.db.query("contentSnapshots").unique())
          )
        ).toMatchObject({ snapshotId, retainUntil: expect.any(Number) });
        expect(
          yield* Effect.promise(() =>
            t.query(async (ctx) =>
              Arr.map(
                await ctx.db.query("contentReleases").collect(),
                ({ sequence }) => sequence
              )
            )
          )
        ).toEqual([3, 4, 5]);
      })
  );
});
