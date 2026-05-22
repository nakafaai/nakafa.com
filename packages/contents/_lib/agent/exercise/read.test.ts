import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import {
  decodeNakafaAgentExerciseResult,
  getNakafaAgentExercise,
} from "@repo/contents/_lib/agent/exercise/read";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const EXERCISE_CONTENT_ID =
  "en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2";

describe("Nakafa agent exercises", () => {
  it("retrieves whole exercise sets, numbered exercises, and missing exercise paths", async () => {
    const exerciseSet = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_ID)
    );

    if (Option.isNone(exerciseSet)) {
      throw new Error("Expected exercise set to exist.");
    }

    const firstExercise = exerciseSet.value.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected exercise set to include at least one item.");
    }

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

    if (
      Option.isNone(numberedExercise) ||
      Option.isNone(explicitExercise) ||
      Option.isNone(explicitNumberedExercise)
    ) {
      throw new Error("Expected numbered exercise lookups to exist.");
    }

    expect(exerciseSet.value.count).toBeGreaterThan(0);
    expect(numberedExercise.value.count).toBe(1);
    expect(explicitExercise.value.exercise_number).toBe(firstExercise.number);
    expect(explicitNumberedExercise.value.exercise_number).toBe(
      firstExercise.number
    );
    expect(Option.isNone(missingExercise)).toBe(true);
    expect(Option.isNone(nonExercise)).toBe(true);
  });

  it("fails with a typed read error when renderable exercise loading fails", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/exercises/renderable", () => ({
      getRenderableExercisesContent: () =>
        Effect.fail(
          new NakafaAgentDataReadError({
            cause: "broken",
            message: "Unable to read Nakafa exercise content.",
          })
        ),
    }));

    const { getNakafaAgentExercise } = await import(
      "@repo/contents/_lib/agent/exercise/read"
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

  it("fails with a typed read error when the exercise result schema rejects output", async () => {
    const error = await Effect.runPromise(
      Effect.match(
        decodeNakafaAgentExerciseResult({
          content_ref: EXERCISE_CONTENT_ID,
          count: 1,
          exercise_number: null,
          exercises: [
            {
              answer: {
                raw: "Answer body",
                title: "Answer",
              },
              choices: [
                {
                  correct: true,
                  label: "A",
                },
              ],
              number: 0,
              question: {
                raw: "Question body",
                title: "Question",
              },
            },
          ],
          locale: "en",
          markdown_url:
            "/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2.md",
          path: "high-school/snbt/general-knowledge/try-out/2026/set-2",
          section: "exercises",
          source_url:
            "/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2",
          title: "Exercise Set",
        }),
        {
          onFailure: (failure) => failure,
          onSuccess: () => null,
        }
      )
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });
});
