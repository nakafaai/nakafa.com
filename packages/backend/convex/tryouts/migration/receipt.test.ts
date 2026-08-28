import { assert, describe, it } from "@effect/vitest";
import { requireCleanupProgress } from "@repo/backend/convex/tryouts/migration/receipt";
import { Effect } from "effect";

describe("tryouts/migration/receipt", () => {
  it.effect(
    "accepts an idempotent terminal cleanup race only after cleanup",
    () =>
      Effect.gen(function* () {
        yield* requireCleanupProgress({ deleted: 0, done: true }, "cleaned");
        const unfinished = yield* requireCleanupProgress(
          { deleted: 0, done: false },
          "sealed"
        ).pipe(Effect.flip);
        const contradictory = yield* requireCleanupProgress(
          { deleted: 0, done: true },
          "sealed"
        ).pipe(Effect.flip);

        assert.strictEqual(
          unfinished.message,
          "Try-out history cleanup made no bounded progress."
        );
        assert.strictEqual(
          contradictory.message,
          "Try-out history cleanup progress disagrees with terminal state."
        );
      })
  );
});
