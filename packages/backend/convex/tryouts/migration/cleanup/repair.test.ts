import { assert, describe, expect, it } from "@effect/vitest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  retainedScaleRepair,
  type ScaleRepairEvidence,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
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

/** Seeds the exact zero-use provisional graph omitted by attempt inventory. */
async function seedUnusedScale(ctx: MutationCtx, responseCount = 0) {
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: retainedScaleRepair.publishedAt,
    questionCount: retainedScaleRepair.questionCount,
    setIdentity: retainedScaleRepair.setIdentity,
    status: "provisional",
    tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
  });
  const itemIds: Id<"irtScaleItems">[] = [];
  const runIds: Id<"irtCalibrationRuns">[] = [];
  for (const { questionCount, sectionIdentity } of retainedScaleRepair.runs) {
    const runId = await ctx.db.insert("irtCalibrationRuns", {
      attemptCount: 0,
      completedAt: retainedScaleRepair.publishedAt,
      iterationCount: 0,
      maxParameterDelta: 0,
      model: "2pl",
      questionCount,
      responseCount,
      scaleVersionId,
      sectionIdentity,
      startedAt: retainedScaleRepair.publishedAt,
      status: "completed",
      updatedAt: retainedScaleRepair.publishedAt,
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
          placementIdentity: `${sectionIdentity}:${question}`,
          placementRowHash: `row:${sectionIdentity}:${question}`,
          responseCount: 0,
          scaleVersionId,
        })
      );
    }
  }
  return { itemIds, runIds, scaleVersionId };
}

/** Seeds signed cleanup plus its exact repair evidence. */
async function seedRepair(t: CleanupTest, responseCount = 0) {
  const cleanup = await seedCleanupSuccess(t);
  const repair = await t.mutation(async (ctx) => {
    const migration = await ctx.db.query("tryoutHistoryMigrations").unique();
    assert.ok(migration?.phase === "completed");
    const graph = await seedUnusedScale(ctx, responseCount);
    return {
      ...graph,
      evidence: {
        ...retainedScaleRepair,
        migrationId: migration.migrationId,
        planHash: migration.authorization.planHash,
        scaleVersionId: graph.scaleVersionId,
        sourceSnapshotId: migration.sourceSnapshotId,
      } satisfies ScaleRepairEvidence,
    };
  });
  return { cleanup, repair };
}

function runCleanup(t: CleanupTest, evidence: ScaleRepairEvidence) {
  return t.mutation((ctx) =>
    runConvexProgram(
      cleanupProgram(
        ctx,
        CLEANUP_MIGRATION_ID,
        CLEANUP_RECEIPT_HASH,
        CLEANUP_PROOF,
        evidence
      )
    )
  );
}

function readRepair(
  t: CleanupTest,
  graph: Awaited<ReturnType<typeof seedUnusedScale>>
) {
  return t.query(async (ctx) => ({
    items: await Promise.all(graph.itemIds.map((id) => ctx.db.get(id))),
    migration: await ctx.db
      .query("tryoutHistoryMigrations")
      .withIndex("by_migrationId", (query) =>
        query.eq("migrationId", CLEANUP_MIGRATION_ID)
      )
      .unique(),
    receipt: await ctx.db.query("tryoutHistoryMigrationReceipts").unique(),
    runs: await Promise.all(graph.runIds.map((id) => ctx.db.get(id))),
    scale: await ctx.db.get(graph.scaleVersionId),
  }));
}

describe("tryouts/migration/cleanup/repair", () => {
  it.effect("audits the exact graph separately from signed cleanup", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { repair } = yield* Effect.promise(() => seedRepair(t));
      const first = yield* Effect.promise(() => runCleanup(t, repair.evidence));
      const repaired = yield* Effect.promise(() => readRepair(t, repair));
      assert.deepStrictEqual(first, { deleted: 0, done: false, repaired: 158 });
      assert.strictEqual(repaired.scale, null);
      assert.ok(repaired.items.every((item) => item === null));
      assert.ok(repaired.runs.every((run) => run === null));
      assert.strictEqual(repaired.migration?.phase, "completed");
      assert.strictEqual(repaired.receipt?.deletedRows, 0);
      assert.deepStrictEqual(repaired.receipt?.proof, CLEANUP_PROOF);
      assert.strictEqual(repaired.receipt?.repair?.deletedRows, 158);
      assert.strictEqual(
        repaired.receipt?.repair?.scaleVersionId,
        repair.scaleVersionId
      );
      assert.ok((repaired.receipt?.repair?.repairedAt ?? 0) > 0);
      let done = false;
      for (let page = 0; page < 32; page += 1) {
        const result = yield* Effect.promise(() =>
          runCleanup(t, repair.evidence)
        );
        if (result.done) {
          done = true;
          break;
        }
      }
      const finished = yield* Effect.promise(() => readRepair(t, repair));
      assert.strictEqual(done, true);
      assert.strictEqual(finished.receipt?.phase, "cleaned");
      assert.strictEqual(finished.receipt?.deletedRows, 82);
      assert.strictEqual(finished.receipt?.repair?.deletedRows, 158);
    })
  );

  it.effect("rejects graph drift before any repair write", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { repair } = yield* Effect.promise(() => seedRepair(t, 1));
      yield* Effect.promise(() =>
        expect(runCleanup(t, repair.evidence)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() => readRepair(t, repair));

      assert.ok(state.scale);
      assert.ok(state.items.every((item) => item !== null));
      assert.ok(state.runs.every((run) => run !== null));
      assert.strictEqual(state.receipt?.repair, undefined);
      assert.strictEqual(state.receipt?.deletedRows, 0);
    })
  );

  it.effect("rejects identity or inventory drift before writes", () =>
    Effect.gen(function* () {
      for (const drift of ["identity", "inventory"] as const) {
        const t = createConvexTestWithBetterAuth();
        const { repair } = yield* Effect.promise(() => seedRepair(t));
        if (drift === "inventory") {
          yield* Effect.promise(() =>
            t.mutation((ctx) => seedUnusedScale(ctx))
          );
        }
        const evidence =
          drift === "identity"
            ? { ...repair.evidence, publishedAt: 2 }
            : repair.evidence;

        yield* Effect.promise(() =>
          expect(runCleanup(t, evidence)).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        const state = yield* Effect.promise(() => readRepair(t, repair));

        assert.ok(state.scale);
        assert.strictEqual(state.receipt?.repair, undefined);
        assert.strictEqual(state.receipt?.deletedRows, 0);
      }
    })
  );

  it.effect("rejects a reverse item reference before writes", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { cleanup, repair } = yield* Effect.promise(() => seedRepair(t));
      const [repairRunId] = repair.runIds;
      assert.ok(repairRunId);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("irtScaleItems", {
            calibrationRunId: repairRunId,
            calibrationStatus: "provisional",
            correctRate: 0,
            difficulty: 0,
            discrimination: 1,
            placementIdentity: "foreign-placement",
            placementRowHash: "foreign-row",
            responseCount: 0,
            scaleVersionId: cleanup.sourceScale.scaleVersionId,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(runCleanup(t, repair.evidence)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() => readRepair(t, repair));

      assert.ok(state.scale);
      assert.strictEqual(state.receipt?.repair, undefined);
    })
  );

  it.effect("rejects external retention before repair writes", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { repair } = yield* Effect.promise(() => seedRepair(t));
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("tryoutHistoryMigrations", {
            artifactMapCount: 0,
            catalogMapCount: 0,
            createdAt: 1,
            migrationId: "external-retention",
            phase: "staging",
            placementMapCount: 0,
            sourceSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
            target: { kind: "pending" },
            updatedAt: 1,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(runCleanup(t, repair.evidence)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
      const state = yield* Effect.promise(() => readRepair(t, repair));

      assert.ok(state.scale);
      assert.ok(state.items.every((item) => item !== null));
      assert.ok(state.runs.every((run) => run !== null));
      assert.strictEqual(state.receipt?.repair, undefined);
    })
  );

  it.effect("rejects terminal target drift before repair writes", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { cleanup, repair } = yield* Effect.promise(() => seedRepair(t));
      yield* Effect.promise(() =>
        t.mutation((ctx) => ctx.db.delete(cleanup.target.bundleId))
      );

      yield* Effect.promise(() =>
        expect(runCleanup(t, repair.evidence)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() => readRepair(t, repair));

      assert.ok(state.scale);
      assert.ok(state.items.every((item) => item !== null));
      assert.ok(state.runs.every((run) => run !== null));
      assert.strictEqual(state.receipt?.proof, undefined);
      assert.strictEqual(state.receipt?.repair, undefined);
    })
  );
});
