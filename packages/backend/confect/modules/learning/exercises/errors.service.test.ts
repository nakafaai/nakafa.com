import { failExercise } from "@repo/backend/confect/modules/learning/exercises/errors.service";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("failExercise", () => {
  it("fails with the exercise error code and message", async () => {
    const exit = await Effect.runPromiseExit(
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
  });

  it("preserves the attempt expiry timestamp", async () => {
    const expiresAtMs = 42;
    const exit = await Effect.runPromiseExit(
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
  });
});
