import { assert, describe, it } from "@effect/vitest";
import {
  countScaleRepairRows,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { requireTerminalRepair } from "@repo/backend/convex/tryouts/migration/status";
import { CLEANUP_PROOF } from "@repo/backend/test/migration/state";
import { Effect } from "effect";

const repair = {
  ...retainedScaleRepair,
  deletedRows: countScaleRepairRows(retainedScaleRepair),
  repairedAt: 1,
  runCount: retainedScaleRepair.runs.length,
};

describe("tryouts/migration/status", () => {
  it.effect("requires the repair after proof or terminal cleanup", () =>
    Effect.gen(function* () {
      for (const [receipt, repairScalePresent] of [
        {
          receipt: {
            migrationId: retainedScaleRepair.migrationId,
            phase: "sealed" as const,
            proof: null,
            repair: null,
          },
          repairScalePresent: true,
        },
        {
          receipt: {
            migrationId: retainedScaleRepair.migrationId,
            phase: "sealed" as const,
            proof: CLEANUP_PROOF,
            repair,
          },
          repairScalePresent: false,
        },
        {
          receipt: {
            migrationId: retainedScaleRepair.migrationId,
            phase: "cleaned" as const,
            proof: CLEANUP_PROOF,
            repair,
          },
          repairScalePresent: false,
        },
        {
          receipt: {
            migrationId: "migration-without-repair",
            phase: "cleaned" as const,
            proof: CLEANUP_PROOF,
            repair: null,
          },
          repairScalePresent: false,
        },
      ].map(
        ({ receipt, repairScalePresent }) =>
          [receipt, repairScalePresent] as const
      )) {
        yield* requireTerminalRepair(receipt, repairScalePresent);
      }

      for (const phase of ["sealed", "cleaned"] as const) {
        for (const damaged of [null, { ...repair, deletedRows: 157 }]) {
          const failure = yield* requireTerminalRepair(
            {
              migrationId: retainedScaleRepair.migrationId,
              phase,
              proof: CLEANUP_PROOF,
              repair: damaged,
            },
            false
          ).pipe(Effect.flip);
          assert.strictEqual(failure.code, "CONTENT_RELEASE_INTEGRITY");
          assert.strictEqual(
            failure.message,
            "Try-out history migration lost its durable repair audit."
          );
        }
      }
      const missingProof = yield* requireTerminalRepair(
        {
          migrationId: retainedScaleRepair.migrationId,
          phase: "sealed",
          proof: null,
          repair,
        },
        false
      ).pipe(Effect.flip);
      assert.strictEqual(missingProof.code, "CONTENT_RELEASE_INTEGRITY");
      const simultaneousLoss = yield* requireTerminalRepair(
        {
          migrationId: retainedScaleRepair.migrationId,
          phase: "sealed",
          proof: null,
          repair: null,
        },
        false
      ).pipe(Effect.flip);
      assert.strictEqual(simultaneousLoss.code, "CONTENT_RELEASE_INTEGRITY");
      const prematureAudit = yield* requireTerminalRepair(
        {
          migrationId: retainedScaleRepair.migrationId,
          phase: "sealed",
          proof: CLEANUP_PROOF,
          repair,
        },
        true
      ).pipe(Effect.flip);
      assert.strictEqual(prematureAudit.code, "CONTENT_RELEASE_INTEGRITY");
    })
  );
});
