import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  ensureCompactionRow,
  isCompactionIdle,
} from "@repo/backend/confect/contentRelease/compact/cycle";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  COMPACTION_OLD_TIME,
  compactionIdentity,
  insertCompaction,
  insertCompletedRelease,
} from "@repo/backend/test/content/compact";
import { insertTestState } from "@repo/backend/test/content/state";
import { convexTest, type TestConvex } from "convex-test";
import { DateTime, Effect } from "effect";

const NOW = DateTime.toEpochMillis(DateTime.nowUnsafe());

/** Runs the idle proof for the stored compaction row in its own mutation. */
function idle(t: TestConvex<typeof schema>) {
  return t.mutation(async (ctx) => {
    const compaction = await ctx.db.query("contentCompaction").unique();
    assert.ok(compaction);
    return await Effect.runPromise(
      isCompactionIdle(compaction).pipe(
        Effect.provide(mutationLayer(confectSchema, ctx))
      )
    );
  });
}

/** Inserts one retained release for each given sequence, then the state row. */
async function seedReleases(
  t: TestConvex<typeof schema>,
  sequences: readonly number[],
  createdAt = NOW
) {
  await t.mutation(async (ctx) => {
    for (const sequence of sequences) {
      await insertCompletedRelease(
        ctx,
        compactionIdentity(sequence),
        undefined,
        createdAt
      );
    }
    await insertTestState(ctx, { nextSequence: 10 });
  });
}

describe("contentRelease/compact/cycle", () => {
  it("carries a deployment's completed floor and cycle out of the state row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestState(ctx, { nextSequence: 4 });
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state);
      await ctx.db.patch("contentState", state._id, {
        compactCursor: "resume-here",
        compactFloor: 3,
        compactFrom: 2,
        compactPhase: "bindings",
        compactStartedAt: 5,
        compactedFloor: 2,
      });
    });

    const carried = await t.mutation((ctx) =>
      Effect.runPromise(
        ensureCompactionRow().pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    const stored = await t.run(async (ctx) => ({
      compaction: await ctx.db.query("contentCompaction").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(carried).toEqual(stored.compaction);
    expect(stored.compaction).toMatchObject({
      compactCursor: "resume-here",
      compactFloor: 3,
      compactFrom: 2,
      compactPhase: "bindings",
      compactStartedAt: 5,
      compactedFloor: 2,
    });
    expect(stored.state).not.toHaveProperty("compactCursor");
    expect(stored.state).not.toHaveProperty("compactFloor");
    expect(stored.state).not.toHaveProperty("compactFrom");
    expect(stored.state).not.toHaveProperty("compactPhase");
    expect(stored.state).not.toHaveProperty("compactStartedAt");
    expect(stored.state).not.toHaveProperty("compactedFloor");
  });
  it("leaves a state row that carried no compaction untouched", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestState(ctx, { nextSequence: 2 }));
    const before = await t.run((ctx) => ctx.db.query("contentState").unique());

    await t.mutation((ctx) =>
      Effect.runPromise(
        ensureCompactionRow().pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );

    expect(await t.run((ctx) => ctx.db.query("contentState").unique())).toEqual(
      before
    );
    expect(
      await t.run((ctx) => ctx.db.query("contentCompaction").unique())
    ).toMatchObject({ compactedFloor: 0 });
  });
  it("reads only the compaction row once it exists", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertCompaction(ctx, { compactedFloor: 4 }));

    const read = await t.mutation(async (ctx) => ({
      row: await Effect.runPromise(
        ensureCompactionRow().pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));

    expect(read.row).toMatchObject({ compactedFloor: 4 });
    expect(read.metrics.documentsRead.used).toBe(1);
    expect(read.metrics.documentsWritten.used).toBe(0);
  });
  it("is idle while the release at the completed floor is retained", async () => {
    const t = convexTest(schema, convexModules);
    await seedReleases(t, [3, 4]);
    await t.mutation((ctx) => insertCompaction(ctx, { compactedFloor: 3 }));

    expect(await idle(t)).toBe(true);
  });
  it.each([
    {
      label: "a cycle is in flight",
      compaction: {
        compactFloor: 4,
        compactFrom: 3,
        compactPhase: "heads",
        compactStartedAt: 1,
        compactedFloor: 3,
      },
      sequences: [3, 4],
    },
    {
      label: "nothing has completed yet",
      compaction: { compactedFloor: 0 },
      sequences: [1],
    },
    {
      label: "no release is stored at or above the floor",
      compaction: { compactedFloor: 5 },
      sequences: [3],
    },
    {
      label: "the oldest release sits above the floor",
      compaction: { compactedFloor: 3 },
      sequences: [4, 5],
    },
  ] as const)("is not idle when $label", async ({ compaction, sequences }) => {
    const t = convexTest(schema, convexModules);
    await seedReleases(t, sequences);
    await t.mutation((ctx) => insertCompaction(ctx, compaction));

    expect(await idle(t)).toBe(false);
  });
  it("is not idle once the release at the completed floor leaves retention", async () => {
    const t = convexTest(schema, convexModules);
    await seedReleases(t, [3, 4], COMPACTION_OLD_TIME);
    await t.mutation((ctx) => insertCompaction(ctx, { compactedFloor: 3 }));

    expect(await idle(t)).toBe(false);
  });
});
