import { describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
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

const initialize = makeFunctionReference<
  "mutation",
  { migrationId: string; sourceSnapshotId: string },
  MigrationStatus
>("tryouts/migration/state/store:initialize");

describe("tryouts/migration/state/store", () => {
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
