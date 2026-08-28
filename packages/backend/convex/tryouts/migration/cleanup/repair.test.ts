import { assert, describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  countScaleRepairRows,
  type ScaleRepairEvidence,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { cleanupProgram } from "@repo/backend/convex/tryouts/migration/cleanup/run";
import {
  seedRepair,
  seedUnusedScale,
} from "@repo/backend/test/migration/repair";
import {
  CLEANUP_MIGRATION_ID,
  CLEANUP_PROOF,
  CLEANUP_RECEIPT_HASH,
  CLEANUP_SOURCE_SNAPSHOT,
} from "@repo/backend/test/migration/state";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

type CleanupTest = TestConvex<typeof schema>;

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
    sourceCatalog: await ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    sourceHistory: await ctx.db
      .query("tryoutHistoryRows")
      .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    sourcePlacements: await ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
  }));
}

async function finishCleanup(t: CleanupTest, evidence: ScaleRepairEvidence) {
  for (let page = 0; page < 32; page += 1) {
    if ((await runCleanup(t, evidence)).done) {
      return;
    }
  }
  assert.fail("Expected bounded cleanup to finish.");
}

describe("tryouts/migration/cleanup/repair", () => {
  it.effect("audits the exact graph separately from signed cleanup", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { repair } = yield* Effect.promise(() => seedRepair(t));
      const first = yield* Effect.promise(() => runCleanup(t, repair.evidence));
      const repaired = yield* Effect.promise(() => readRepair(t, repair));
      const repairedRows = countScaleRepairRows(repair.evidence);
      assert.deepStrictEqual(first, {
        deleted: 0,
        done: false,
        repaired: repairedRows,
      });
      assert.strictEqual(repaired.scale, null);
      assert.ok(repaired.items.every((item) => item === null));
      assert.ok(repaired.runs.every((run) => run === null));
      assert.strictEqual(repaired.migration?.phase, "completed");
      assert.strictEqual(repaired.receipt?.deletedRows, 0);
      assert.deepStrictEqual(repaired.receipt?.proof, CLEANUP_PROOF);
      assert.strictEqual(repaired.receipt?.repair?.deletedRows, repairedRows);
      assert.deepStrictEqual(repaired.sourceCatalog, []);
      assert.strictEqual(repaired.sourceHistory.length, 2);
      assert.deepStrictEqual(repaired.sourcePlacements, []);
      assert.strictEqual(
        repaired.receipt?.repair?.scaleVersionId,
        repair.scaleVersionId
      );
      assert.ok((repaired.receipt?.repair?.repairedAt ?? 0) > 0);
      yield* Effect.promise(() => finishCleanup(t, repair.evidence));
      const finished = yield* Effect.promise(() => readRepair(t, repair));
      assert.strictEqual(finished.receipt?.phase, "cleaned");
      assert.strictEqual(finished.receipt?.deletedRows, 16);
      assert.strictEqual(finished.receipt?.repair?.deletedRows, repairedRows);
    })
  );

  it.effect("rejects a cleaned retry without its exact repair audit", () =>
    Effect.gen(function* () {
      for (const damage of ["missing", "tampered"] as const) {
        const t = createConvexTestWithBetterAuth();
        const { repair } = yield* Effect.promise(() => seedRepair(t));
        yield* Effect.promise(() => runCleanup(t, repair.evidence));
        yield* Effect.promise(() => finishCleanup(t, repair.evidence));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const receipt = await ctx.db
              .query("tryoutHistoryMigrationReceipts")
              .unique();
            assert.ok(receipt?.repair);
            await ctx.db.patch(receipt._id, {
              repair:
                damage === "missing"
                  ? undefined
                  : {
                      ...receipt.repair,
                      deletedRows: receipt.repair.deletedRows - 1,
                    },
            });
          })
        );

        yield* Effect.promise(() =>
          expect(runCleanup(t, repair.evidence)).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      }
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

  it.effect("rejects signed placement drift before any repair write", () =>
    Effect.gen(function* () {
      for (const drift of ["identity", "rowHash", "section"] as const) {
        const t = createConvexTestWithBetterAuth();
        const { repair } = yield* Effect.promise(() =>
          seedRepair(t, 0, ["general-reasoning", "english-language"])
        );
        const [firstItemId, secondItemId] = repair.itemIds;
        const [firstRunId, secondRunId] = repair.runIds;
        assert.ok(firstItemId && secondItemId && firstRunId && secondRunId);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            if (drift === "identity") {
              await ctx.db.patch(firstItemId, {
                placementIdentity: "drifted-placement",
              });
              return;
            }
            if (drift === "rowHash") {
              await ctx.db.patch(firstItemId, {
                placementRowHash: "drifted-row",
              });
              return;
            }
            await ctx.db.patch(firstItemId, {
              calibrationRunId: secondRunId,
            });
            await ctx.db.patch(secondItemId, {
              calibrationRunId: firstRunId,
            });
          })
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
        assert.strictEqual(state.receipt?.repair, undefined);
      }
    })
  );

  it.effect("rejects duplicate run identities before any repair write", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const { repair } = yield* Effect.promise(() =>
        seedRepair(t, 0, ["general-reasoning", "english-language"])
      );
      const [firstRun, secondRun] = repair.runIds;
      const [firstEvidence, secondEvidence] = repair.evidence.runs;
      assert.ok(firstRun && secondRun && firstEvidence && secondEvidence);
      assert.strictEqual(
        firstEvidence.questionCount,
        secondEvidence.questionCount
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.patch(secondRun, {
            sectionIdentity: firstEvidence.sectionIdentity,
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
      assert.ok(state.items.every((item) => item !== null));
      assert.ok(state.runs.every((run) => run !== null));
      assert.strictEqual(state.receipt?.repair, undefined);
      assert.strictEqual(state.receipt?.proof, undefined);
    })
  );

  it.effect("rejects identity or inventory drift before writes", () =>
    Effect.gen(function* () {
      for (const drift of ["identity", "inventory"] as const) {
        const t = createConvexTestWithBetterAuth();
        const { repair, source } = yield* Effect.promise(() => seedRepair(t));
        if (drift === "inventory") {
          yield* Effect.promise(() =>
            t.mutation((ctx) => seedUnusedScale(ctx, source))
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
