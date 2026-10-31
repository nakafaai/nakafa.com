import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

describe("tryouts/queries/attempt", () => {
  it.effect("locks only one exact authenticated in-progress attempt", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const { attemptId } = yield* world.start();
      const isLocked = tryouts.queries.attempt.isLockedByAttemptId;
      expect(yield* world.visitor.query(isLocked, { attemptId })).toBe(false);
      expect(
        yield* world.learner.query(isLocked, { attemptId: "not-an-id" })
      ).toBe(false);
      expect(yield* world.learner.query(isLocked, { attemptId })).toBe(true);
      yield* Effect.promise(() =>
        world.t.mutation((ctx) =>
          ctx.db.patch("tryoutAttempts", attemptId, {
            completedAt: TRYOUT_NOW + 1,
            endReason: "submitted",
            status: "completed",
          })
        )
      );
      expect(yield* world.learner.query(isLocked, { attemptId })).toBe(false);
    })
  );
});
