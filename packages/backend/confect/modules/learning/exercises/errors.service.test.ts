import { describe, expect, it } from "@effect/vitest";
import { failExercise } from "@repo/backend/confect/modules/learning/exercises/errors.service";
import { Cause, Effect, Exit, Option } from "effect";

describe("failExercise", () => {
  it.effect("fails with the exercise error code and message", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        failExercise("TIME_EXPIRED", "Time expired.")
      );
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        return;
      }

      const error = Cause.failureOption(exit.cause);

      expect(Option.isSome(error)).toBe(true);
      expect(Option.getOrThrow(error)).toMatchObject({
        _tag: "ExerciseError",
        code: "TIME_EXPIRED",
        message: "Time expired.",
      });
    })
  );

  it.effect("preserves the attempt expiry timestamp", () =>
    Effect.gen(function* () {
      const expiresAtMs = 42;
      const exit = yield* Effect.exit(
        failExercise("TRYOUT_EXPIRED", "Tryout expired.", expiresAtMs)
      );

      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        return;
      }

      const error = Cause.failureOption(exit.cause);

      expect(Option.isSome(error)).toBe(true);
      expect(Option.getOrThrow(error)).toMatchObject({
        _tag: "ExerciseError",
        code: "TRYOUT_EXPIRED",
        expiresAtMs,
        message: "Tryout expired.",
      });
    })
  );
});
