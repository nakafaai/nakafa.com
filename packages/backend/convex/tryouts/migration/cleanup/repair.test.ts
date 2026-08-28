import { assert, describe, expect, it } from "@effect/vitest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { cleanupProgram } from "@repo/backend/convex/tryouts/migration/cleanup/run";
import { seedCleanupSuccess } from "@repo/backend/test/migration/seed";
import {
  CLEANUP_MIGRATION_ID,
  CLEANUP_PROOF,
  CLEANUP_RECEIPT_HASH,
  CLEANUP_SOURCE_SNAPSHOT,
} from "@repo/backend/test/migration/state";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

type CleanupTest = TestConvex<typeof schema>;

const QUESTION_COUNTS = [20, 20, 20, 30, 20, 20, 20] as const;

/** Seeds the zero-use provisional graph that blocked production cleanup. */
async function seedUnusedScale(ctx: MutationCtx, responseCount = 0) {
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: 1,
    questionCount: 150,
    setIdentity: ["en", "set", "indonesia", "snbt", "2027", "set-2", ""].join(
      "\0"
    ),
    status: "provisional",
    tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
  });
  const itemIds: Id<"irtScaleItems">[] = [];
  const runIds: Id<"irtCalibrationRuns">[] = [];
  for (const [index, questionCount] of QUESTION_COUNTS.entries()) {
    const runId = await ctx.db.insert("irtCalibrationRuns", {
      attemptCount: 0,
      completedAt: 1,
      iterationCount: 0,
      maxParameterDelta: 0,
      model: "2pl",
      questionCount,
      responseCount,
      scaleVersionId,
      sectionIdentity: `section:${index}`,
      startedAt: 1,
      status: "completed",
      updatedAt: 1,
    });
    runIds.push(runId);
    for (let question = 0; question < questionCount; question += 1) {
      itemIds.push(
        await ctx.db.insert("irtScaleItems", {
          calibrationRunId: runId,
          calibrationStatus: "provisional",
          correctRate: 0,
          difficulty: 0,
          discrimination: 1,
          placementIdentity: `placement:${index}:${question}`,
          placementRowHash: `row:${index}:${question}`,
          responseCount: 0,
          scaleVersionId,
        })
      );
    }
  }
  return { itemIds, runIds, scaleVersionId };
}

/** Runs one bounded production cleanup transaction. */
function runCleanup(t: CleanupTest) {
  return t.mutation((ctx) =>
    runConvexProgram(
      cleanupProgram(
        ctx,
        CLEANUP_MIGRATION_ID,
        CLEANUP_RECEIPT_HASH,
        CLEANUP_PROOF
      )
    )
  );
}

describe("tryouts/migration/cleanup/repair", () => {
  it.effect("removes the unused provisional graph before signed cleanup", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupSuccess(t));
      const unused = yield* Effect.promise(() =>
        t.mutation((ctx) => seedUnusedScale(ctx))
      );
      let done = false;
      for (let page = 0; page < 32; page += 1) {
        const result = yield* Effect.promise(() => runCleanup(t));
        if (result.done) {
          done = true;
          break;
        }
      }
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          receipt: await ctx.db
            .query("tryoutHistoryMigrationReceipts")
            .unique(),
          items: await Promise.all(unused.itemIds.map((id) => ctx.db.get(id))),
          runs: await Promise.all(unused.runIds.map((id) => ctx.db.get(id))),
          scale: await ctx.db.get(unused.scaleVersionId),
        }))
      );

      assert.strictEqual(done, true);
      assert.strictEqual(state.scale, null);
      assert.ok(state.items.every((item) => item === null));
      assert.ok(state.runs.every((run) => run === null));
      assert.strictEqual(state.receipt?.phase, "cleaned");
      assert.strictEqual(state.receipt?.deletedRows, 82);
    })
  );

  it.effect("rolls back when the provisional graph has runtime evidence", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupSuccess(t));
      const unused = yield* Effect.promise(() =>
        t.mutation((ctx) => seedUnusedScale(ctx, 1))
      );
      yield* Effect.promise(() =>
        expect(runCleanup(t)).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Retained cleanup cannot prove the unused provisional scale graph.",
          },
        })
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          migration: await ctx.db.query("tryoutHistoryMigrations").unique(),
          receipt: await ctx.db
            .query("tryoutHistoryMigrationReceipts")
            .unique(),
          items: await Promise.all(unused.itemIds.map((id) => ctx.db.get(id))),
          runs: await Promise.all(unused.runIds.map((id) => ctx.db.get(id))),
          scale: await ctx.db.get(unused.scaleVersionId),
        }))
      );

      assert.ok(state.scale);
      assert.ok(state.items.every((item) => item !== null));
      assert.ok(state.runs.every((run) => run !== null));
      assert.strictEqual(state.migration?.phase, "completed");
      assert.strictEqual(state.receipt?.deletedRows, 0);
    })
  );

  it.effect("rejects an ambiguous provisional inventory without writes", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupSuccess(t));
      const unused = yield* Effect.promise(() =>
        t.mutation(async (ctx) => [
          await seedUnusedScale(ctx),
          await seedUnusedScale(ctx),
        ])
      );
      yield* Effect.promise(() =>
        expect(runCleanup(t)).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Retained cleanup found an unexpected provisional scale inventory.",
          },
        })
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          receipt: await ctx.db
            .query("tryoutHistoryMigrationReceipts")
            .unique(),
          scales: await Promise.all(
            unused.map(({ scaleVersionId }) => ctx.db.get(scaleVersionId))
          ),
        }))
      );

      assert.ok(state.scales.every((scale) => scale !== null));
      assert.strictEqual(state.receipt?.deletedRows, 0);
    })
  );
});
