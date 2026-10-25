import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { ensureCompaction } from "@repo/backend/confect/contentRelease/compact/state";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  COMPACTION_OLD_TIME,
  compact,
  compactionIdentity,
  insertCompaction,
  insertCompletedRelease,
  markBootstrap,
  seedCompactionHistory,
} from "@repo/backend/test/content/compact";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";
import { Array as Arr, DateTime, Effect } from "effect";

const NOW = DateTime.toEpochMillis(DateTime.nowUnsafe());

describe("contentRelease/compact/state", () => {
  it("distinguishes a newly persisted cycle, a resumed cycle, and its exact completed floor", async () => {
    const t = convexTest(schema, convexModules);
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        compaction: {
          compactedFloor: 0,
        },
        floor: 1,
        phase: "heads",
      },
    });
    const resumed = await compact(t);
    expect(resumed).toMatchObject({
      complete: false,
      cycle: {
        compaction: {
          compactPhase: "heads",
        },
      },
    });
    await t.mutation(async (ctx) => {
      const compaction = await ctx.db.query("contentCompaction").unique();
      assert.ok(compaction);
      await ctx.db.patch("contentCompaction", compaction._id, {
        compactFloor: undefined,
        compactFrom: undefined,
        compactPhase: undefined,
        compactStartedAt: undefined,
        compactedFloor: 1,
      });
    });
    expect(await compact(t)).toEqual({
      complete: true,
      floor: 1,
    });
  });
  it.each([
    {
      state: { nextSequence: 0 },
    },
    {
      compaction: { compactedFloor: -1 },
    },
    {
      compaction: { compactedFloor: 3 },
    },
    {
      state: { activeReleaseId: "incomplete" },
    },
    {
      compaction: { compactPhase: "heads" },
    },
    {
      compaction: { compactCursor: "orphaned-production-cursor" },
    },
  ] as const)("rejects invalid lifecycle state %j", async (patch) => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestState(ctx, {
        nextSequence: 2,
      });
      await insertCompaction(ctx);
      const state = await ctx.db.query("contentState").unique();
      const compaction = await ctx.db.query("contentCompaction").unique();
      assert.ok(state && compaction);
      await ctx.db.patch("contentState", state._id, patch.state ?? {});
      await ctx.db.patch(
        "contentCompaction",
        compaction._id,
        patch.compaction ?? {}
      );
    });
    await expect(compact(t)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("rejects duplicate retained sequence numbers before deleting any history", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (const releaseId of ["first", "duplicate"]) {
        await insertZeroRelease(ctx, {
          ...compactionIdentity(1),
          releaseId,
          ownership: {
            base: [],
            result: [],
          },
          role: "candidate",
          status: "aborted",
        });
      }
      await insertTestState(ctx, {
        nextSequence: 3,
      });
    });
    await expect(compact(t)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("keeps the recent release boundary when a frozen runtime names an older release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedCompactionHistory(ctx);
      const recent = await ctx.db
        .query("contentReleases")
        .withIndex("by_sequence", (q) => q.eq("sequence", 2))
        .unique();
      assert.ok(recent);
      await ctx.db.patch("contentReleases", recent._id, {
        createdAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
      });
      await ctx.db.insert("tryoutRuntimeBundles", {
        bundleHash: "technical",
        bundleJson: "{}",
        createdAt: 0,
        rendererJson: "{}",
        rendererManifestHash: "technical",
        snapshotId: "technical",
        sourceGitSha: "technical",
        sourceManifestHash: compactionIdentity(1).manifestHash,
        sourceReleaseId: compactionIdentity(1).releaseId,
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("advances only through a bounded old-release window", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let sequence = 1; sequence <= 36; sequence += 1) {
        await insertCompletedRelease(ctx, compactionIdentity(sequence));
      }
      await insertTestState(ctx, {
        nextSequence: 37,
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 33,
      },
    });
  });
  it("keeps history intact when the provider returns an empty unfinished page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedCompactionHistory(ctx));
    await t.mutation(async (ctx) => {
      const before = await ctx.db.query("contentState").unique();
      const read = ctx.db.query.bind(ctx.db);
      const query = vi.spyOn(ctx.db, "query").mockImplementation((table) => {
        const rows = read(table);
        const withIndex = rows.withIndex.bind(rows);
        vi.spyOn(rows, "withIndex").mockImplementation((index, range) => {
          const indexed = withIndex(index, range);
          if (table === "contentReleases") {
            const order = indexed.order.bind(indexed);
            vi.spyOn(indexed, "order").mockImplementation((direction) => {
              const ordered = order(direction);
              vi.spyOn(ordered, "paginate").mockResolvedValueOnce({
                continueCursor: "byte-limited-page",
                isDone: false,
                page: [],
                pageStatus: "SplitRequired",
              });
              return ordered;
            });
          }
          return indexed;
        });
        return rows;
      });
      expect(
        await Effect.runPromise(
          ensureCompaction().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      ).toEqual({
        complete: true,
        floor: 0,
      });
      query.mockRestore();
      expect(await ctx.db.query("contentState").unique()).toEqual(before);
      expect(await ctx.db.query("contentReleases").collect()).toHaveLength(5);
      expect(
        await Effect.runPromise(
          ensureCompaction().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      ).toMatchObject({
        complete: false,
        cycle: {
          floor: 3,
        },
      });
    });
  });
  it("starts a cycle once the release at the completed floor leaves retention", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const releases = Arr.makeBy(5, (index) => compactionIdentity(index + 1));
      for (const [index, release] of Arr.map(
        releases,
        (identity, position) => [position, identity] as const
      )) {
        await insertCompletedRelease(
          ctx,
          release,
          releases[index - 1],
          index === 0 ? COMPACTION_OLD_TIME : NOW
        );
      }
      await insertTestState(ctx, {
        active: releases[4],
        nextSequence: 6,
      });
      await insertCompaction(ctx, { compactedFloor: 1 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
        from: 1,
        phase: "heads",
      },
    });
  });
  it("does not keep a release below the bootstrap floor inside the retention window", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retained = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      const active = compactionIdentity(3);
      await insertCompletedRelease(ctx, retained, undefined, NOW);
      await insertCompletedRelease(
        ctx,
        bootstrap,
        undefined,
        COMPACTION_OLD_TIME
      );
      await markBootstrap(ctx, bootstrap);
      await insertCompletedRelease(ctx, active, bootstrap, COMPACTION_OLD_TIME);
      await insertTestState(ctx, { active, nextSequence: 4 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("starts a cycle when a bootstrap floor passes the completed floor inside retention", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(ctx, retired, undefined, NOW);
      await insertCompletedRelease(ctx, bootstrap, undefined, NOW);
      await markBootstrap(ctx, bootstrap);
      await insertTestState(ctx, { active: bootstrap, nextSequence: 3 });
      await insertCompaction(ctx, { compactedFloor: 1 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
        from: 1,
        phase: "heads",
      },
    });
  });
});
