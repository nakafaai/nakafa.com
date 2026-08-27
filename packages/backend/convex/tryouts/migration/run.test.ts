import { assert, describe, it } from "@effect/vitest";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { drainAttempts } from "@repo/backend/convex/tryouts/migration/run";
import { Effect } from "effect";

describe("tryouts/migration/run", () => {
  it.effect("drains one transaction per audited attempt", () =>
    Effect.gen(function* () {
      let calls = 0;
      const migrated = yield* drainAttempts(() => {
        calls += 1;
        return Effect.succeed({ done: calls === 3, migrated: 1 });
      }, 3);

      assert.strictEqual(migrated, 3);
      assert.strictEqual(calls, 3);
    })
  );

  it.effect("rejects stalled and over-bound transaction streams", () =>
    Effect.gen(function* () {
      const stalled = yield* drainAttempts(
        () => Effect.succeed({ done: false, migrated: 0 }),
        3
      ).pipe(Effect.flip);
      const overBound = yield* drainAttempts(
        () => Effect.succeed({ done: false, migrated: 1 }),
        2
      ).pipe(Effect.flip);

      assert.strictEqual(stalled.code, "CONTENT_RELEASE_INTEGRITY");
      assert.ok(stalled.message.includes("no bounded attempt progress"));
      assert.strictEqual(overBound.code, "CONTENT_RELEASE_INTEGRITY");
      assert.ok(overBound.message.includes("audited attempt bound"));
    })
  );

  it.effect("preserves typed mutation failures", () => {
    const failure = new ReleaseError({
      code: "CONTENT_RELEASE_STATE",
      message: "Migration root changed.",
    });
    return drainAttempts(() => Effect.fail(failure), 1).pipe(
      Effect.flip,
      Effect.map((error) => assert.strictEqual(error, failure))
    );
  });
});
