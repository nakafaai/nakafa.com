import { assert, describe, it } from "@effect/vitest";
import { verifySourceAttemptClosure } from "@repo/backend/convex/tryouts/migration/plan";
import { Effect } from "effect";

const inventory = [
  { attempt: { _id: "attempt-a" } },
  { attempt: { _id: "attempt-b" } },
];

describe("tryouts/migration/plan", () => {
  it.effect("accepts the exact signed attempt closure", () =>
    verifySourceAttemptClosure(
      [{ _id: "attempt-a" }, { _id: "attempt-b" }],
      inventory
    )
  );

  it.effect("rejects missing, extra, and substituted source attempts", () =>
    Effect.gen(function* () {
      const invalid = [
        [{ _id: "attempt-a" }],
        [{ _id: "attempt-a" }, { _id: "attempt-b" }, { _id: "attempt-c" }],
        [{ _id: "attempt-a" }, { _id: "attempt-c" }],
      ];
      for (const sourceAttempts of invalid) {
        const error = yield* verifySourceAttemptClosure(
          sourceAttempts,
          inventory
        ).pipe(Effect.flip);
        assert.strictEqual(error.code, "CONTENT_RELEASE_STATE");
        assert.ok(error.message.includes("unmarked source attempt"));
      }
    })
  );
});
