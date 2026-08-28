import { describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  countScaleRepairRows,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import type {
  migrationRecordValidator,
  migrationStatusValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  ABORT_MIGRATION_ID,
  ABORT_SOURCE_SNAPSHOT,
  seedPendingAbort,
} from "@repo/backend/test/migration/abort";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type MigrationStatus = Infer<typeof migrationStatusValidator>;
type MigrationRecord = Infer<typeof migrationRecordValidator>;

const initialize = makeFunctionReference<
  "mutation",
  { migrationId: string; sourceSnapshotId: string },
  MigrationStatus
>("tryouts/migration/state/store:initialize");
const record = makeFunctionReference<
  "query",
  { migrationId: string },
  MigrationRecord
>("tryouts/migration/state/store:record");

describe("tryouts/migration/state/store", () => {
  it.effect("projects the durable terminal repair audit", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const repair = {
        ...retainedScaleRepair,
        deletedRows: countScaleRepairRows(retainedScaleRepair),
        repairedAt: 1,
        runCount: retainedScaleRepair.runs.length,
      };
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("tryoutHistoryMigrationReceipts", {
            cleanupLimit: 1,
            completedAt: 1,
            deletedRows: 1,
            migratedAttempts: 0,
            migratedScaleItems: 0,
            migratedScaleRuns: 0,
            migratedScaleVersions: 0,
            migrationId: retainedScaleRepair.migrationId,
            phase: "cleaned",
            planHash: retainedScaleRepair.planHash,
            receiptHash: "receipt-hash",
            receiptJson: "receipt-json",
            recordedAt: 1,
            repair,
            sourceSnapshotId: retainedScaleRepair.sourceSnapshotId,
            targetBundleHash: "target-bundle",
            targetSnapshotId: "target-snapshot",
          })
        )
      );

      const stored = yield* Effect.promise(() =>
        t.query(record, { migrationId: retainedScaleRepair.migrationId })
      );
      expect(stored.receipt?.repair).toEqual(repair);
    })
  );

  it.effect("rejects duplicate abort tombstones", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          for (const migrationId of [ABORT_MIGRATION_ID, "duplicate"]) {
            await ctx.db.insert("tryoutHistoryMigrationAborts", {
              abortedAt: 1,
              deleted: 1,
              migrationId,
              sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
            });
          }
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation(initialize, {
            migrationId: ABORT_MIGRATION_ID,
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it.effect("rejects simultaneous root and abort evidence", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedPendingAbort(ctx);
          await ctx.db.insert("tryoutHistoryMigrationAborts", {
            abortedAt: 1,
            deleted: 1,
            migrationId: ABORT_MIGRATION_ID,
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
          });
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation(initialize, {
            migrationId: ABORT_MIGRATION_ID,
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it.effect("preserves abort evidence owned by another migration", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("tryoutHistoryMigrationAborts", {
            abortedAt: 1,
            deleted: 1,
            migrationId: "foreign",
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation(initialize, {
            migrationId: ABORT_MIGRATION_ID,
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
      const tombstone = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutHistoryMigrationAborts").unique())
      );
      expect(tombstone?.migrationId).toBe("foreign");
    })
  );
});
