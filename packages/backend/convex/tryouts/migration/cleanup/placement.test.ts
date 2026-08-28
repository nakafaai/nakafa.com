import { assert, describe, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  countScaleRepairRows,
  type ScaleRepairEvidence,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { cleanupProgram } from "@repo/backend/convex/tryouts/migration/cleanup/run";
import { seedUnorderedScalePlacements } from "@repo/backend/test/migration/repair";
import {
  CLEANUP_MIGRATION_ID,
  CLEANUP_PROOF,
  CLEANUP_RECEIPT_HASH,
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

describe("tryouts/migration/cleanup/placement", () => {
  it.effect(
    "accepts exact question ownership independent of source index order",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          seedUnorderedScalePlacements(t)
        );
        const { evidence, repair } = seeded;

        const result = yield* Effect.promise(() => runCleanup(t, evidence));
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            items: await Promise.all(
              repair.itemIds.map((id) => ctx.db.get(id))
            ),
            receipt: await ctx.db
              .query("tryoutHistoryMigrationReceipts")
              .unique(),
            runs: await Promise.all(repair.runIds.map((id) => ctx.db.get(id))),
            scale: await ctx.db.get(repair.scaleVersionId),
          }))
        );

        assert.deepStrictEqual(result, {
          deleted: 0,
          done: false,
          repaired: countScaleRepairRows(evidence),
        });
        assert.strictEqual(state.scale, null);
        assert.ok(state.items.every((item) => item === null));
        assert.ok(state.runs.every((run) => run === null));
        assert.strictEqual(
          state.receipt?.repair?.deletedRows,
          countScaleRepairRows(evidence)
        );
      })
  );
});
