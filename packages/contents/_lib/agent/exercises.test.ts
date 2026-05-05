import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercises";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const EXERCISE_CONTENT_ID =
  "en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2";

describe("Nakafa agent exercises", () => {
  it("retrieves whole exercise sets, numbered exercises, and missing exercise paths", async () => {
    const exerciseSet = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_ID)
    );
    const firstExercise = Option.getOrThrow(exerciseSet).exercises[0];
    const numberedExercise = await Effect.runPromise(
      getNakafaAgentExercise(`${EXERCISE_CONTENT_ID}/${firstExercise.number}`)
    );
    const explicitExercise = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_ID, firstExercise.number)
    );
    const explicitNumberedExercise = await Effect.runPromise(
      getNakafaAgentExercise(
        `${EXERCISE_CONTENT_ID}/${firstExercise.number}`,
        firstExercise.number
      )
    );
    const missingExercise = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_ID, 99_999)
    );
    const nonExercise = await Effect.runPromise(
      getNakafaAgentExercise("en/quran/1")
    );

    expect(Option.getOrThrow(exerciseSet).count).toBeGreaterThan(0);
    expect(Option.getOrThrow(numberedExercise).count).toBe(1);
    expect(Option.getOrThrow(explicitExercise).exercise_number).toBe(
      firstExercise.number
    );
    expect(Option.getOrThrow(explicitNumberedExercise).exercise_number).toBe(
      firstExercise.number
    );
    expect(Option.isNone(missingExercise)).toBe(true);
    expect(Option.isNone(nonExercise)).toBe(true);
  });

  it("fails with a typed read error when renderable exercise loading fails", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/exercises/renderable", () => ({
      getRenderableExercisesContent: () => Promise.reject(new Error("broken")),
    }));

    const { NakafaAgentDataReadError } = await import(
      "@repo/contents/_lib/agent/errors"
    );
    const { getNakafaAgentExercise } = await import(
      "@repo/contents/_lib/agent/exercises"
    );
    const error = await Effect.runPromise(
      Effect.match(getNakafaAgentExercise(EXERCISE_CONTENT_ID), {
        onFailure: (failure) => failure,
        onSuccess: () => null,
      })
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
    vi.doUnmock("@repo/contents/_lib/exercises/renderable");
    vi.resetModules();
  });
});
