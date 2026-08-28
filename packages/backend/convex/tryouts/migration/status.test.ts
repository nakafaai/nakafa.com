import { assert, describe, it } from "@effect/vitest";
import {
  countScaleRepairRows,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { requireTerminalRepair } from "@repo/backend/convex/tryouts/migration/status";
import { Effect } from "effect";

const repair = {
  ...retainedScaleRepair,
  deletedRows: countScaleRepairRows(retainedScaleRepair),
  repairedAt: 1,
  runCount: retainedScaleRepair.runs.length,
};

describe("tryouts/migration/status", () => {
  it.effect("requires the exact durable repair before cleaned status", () =>
    Effect.gen(function* () {
      yield* requireTerminalRepair({
        migrationId: retainedScaleRepair.migrationId,
        phase: "cleaned",
        repair,
      });
      yield* requireTerminalRepair({
        migrationId: "migration-without-repair",
        phase: "cleaned",
        repair: null,
      });

      for (const damaged of [null, { ...repair, deletedRows: 157 }]) {
        const failure = yield* requireTerminalRepair({
          migrationId: retainedScaleRepair.migrationId,
          phase: "cleaned",
          repair: damaged,
        }).pipe(Effect.flip);
        assert.strictEqual(failure.code, "CONTENT_RELEASE_INTEGRITY");
        assert.strictEqual(
          failure.message,
          "Cleaned try-out history migration lost its durable repair audit."
        );
      }
    })
  );
});
