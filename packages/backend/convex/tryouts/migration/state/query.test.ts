import { describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  countScaleRepairRows,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import type {
  cleanupReceiptValidator,
  mapEntryValidator,
  targetRuntimeValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  ABORT_MIGRATION_ID,
  seedOwnedAbort,
  seedPendingAbort,
} from "@repo/backend/test/migration/abort";
import { seedCleanupSuccess } from "@repo/backend/test/migration/seed";
import { CLEANUP_MIGRATION_ID } from "@repo/backend/test/migration/state";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type MapEntry = Infer<typeof mapEntryValidator>;
type TargetRuntime = Infer<typeof targetRuntimeValidator>;
type CleanupReceipt = Infer<typeof cleanupReceiptValidator>;

const mapEntries = makeFunctionReference<
  "query",
  { migrationId: string },
  MapEntry[]
>("tryouts/migration/state/query:mapEntries");
const targetRuntime = makeFunctionReference<
  "query",
  { migrationId: string },
  TargetRuntime
>("tryouts/migration/state/query:targetRuntime");
const cleanupReceipt = makeFunctionReference<
  "query",
  { migrationId: string },
  CleanupReceipt
>("tryouts/migration/state/query:receipt");

describe("tryouts/migration/state/query", () => {
  it.effect("projects the complete durable repair audit", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupSuccess(t));
      const repair = {
        ...retainedScaleRepair,
        deletedRows: countScaleRepairRows(retainedScaleRepair),
        repairedAt: 1,
        runCount: retainedScaleRepair.runs.length,
      };
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const receipt = await ctx.db
            .query("tryoutHistoryMigrationReceipts")
            .unique();
          expect(receipt).not.toBeNull();
          if (receipt) {
            await ctx.db.patch(receipt._id, { repair });
          }
        })
      );

      const projected = yield* Effect.promise(() =>
        t.query(cleanupReceipt, { migrationId: CLEANUP_MIGRATION_ID })
      );

      expect(projected?.repair).toEqual(repair);
    })
  );

  it.effect("projects the staged ledger and immutable runtime", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedOwnedAbort));

      const [entries, runtime] = yield* Effect.all([
        Effect.promise(() =>
          t.query(mapEntries, { migrationId: ABORT_MIGRATION_ID })
        ),
        Effect.promise(() =>
          t.query(targetRuntime, { migrationId: ABORT_MIGRATION_ID })
        ),
      ]);

      expect(entries).toEqual([
        {
          identity: "artifact:owned",
          index: 0,
          kind: "artifact",
          newHash: `sha256:${"3".repeat(64)}`,
          oldHash: `sha256:${"b".repeat(64)}`,
        },
        {
          identity: "artifact:shared",
          index: 1,
          kind: "artifact",
          newHash: `sha256:${"4".repeat(64)}`,
          oldHash: `sha256:${"c".repeat(64)}`,
        },
        {
          identity: "catalog:abort",
          index: 0,
          kind: "catalog",
          newHash: `sha256:${"5".repeat(64)}`,
          oldHash: `sha256:${"9".repeat(64)}`,
        },
        {
          identity: "placement:abort",
          index: 1,
          kind: "placement",
          newHash: `sha256:${"6".repeat(64)}`,
          oldHash: `sha256:${"a".repeat(64)}`,
        },
      ]);
      expect(runtime).toEqual({
        bundleJson: "owned-runtime",
        rendererJson: "owned-renderer",
      });
    })
  );

  it.effect("hides runtime bytes until the migration target is staged", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedPendingAbort));

      const runtime = yield* Effect.promise(() =>
        t.query(targetRuntime, { migrationId: ABORT_MIGRATION_ID })
      );

      expect(runtime).toBeNull();
    })
  );
});
