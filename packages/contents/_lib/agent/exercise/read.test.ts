import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import {
  decodeNakafaAgentExerciseResult,
  getNakafaAgentExercise,
} from "@repo/contents/_lib/agent/exercise/read";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const EXERCISE_ROUTE =
  "exercises/high-school/snbt/general-knowledge/try-out/2026/set-2";
const EXERCISE_CONTENT_REF = `https://nakafa.com/en/${EXERCISE_ROUTE}`;

const mockExercises = vi.hoisted(() => [
  {
    answer: {
      metadata: { title: "Answer 1" },
      raw: "Jawaban nomor 1.",
    },
    choices: {
      en: [
        { label: "A", value: true },
        { label: "B", value: false },
      ],
      id: [
        { label: "A", value: true },
        { label: "B", value: false },
      ],
    },
    number: 1,
    question: {
      metadata: { title: "Question 1" },
      raw: "Pertanyaan nomor 1.",
    },
  },
]);

vi.mock("@repo/contents/_lib/exercises/renderable", async () => {
  const { Effect } = await import("effect");

  return {
    getRenderableExercisesContent: () => Effect.succeed(mockExercises),
  };
});

describe("Nakafa agent exercises", () => {
  it("retrieves whole exercise sets, numbered exercises, and missing exercise paths", async () => {
    const exerciseSet = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_REF)
    );

    if (Option.isNone(exerciseSet)) {
      throw new Error("Expected exercise set to exist.");
    }

    const firstExercise = exerciseSet.value.exercises[0];

    if (!firstExercise) {
      throw new Error("Expected exercise set to include at least one item.");
    }

    const numberedExercise = await Effect.runPromise(
      getNakafaAgentExercise(`${EXERCISE_CONTENT_REF}/${firstExercise.number}`)
    );
    const explicitExercise = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_REF, firstExercise.number)
    );
    const explicitNumberedExercise = await Effect.runPromise(
      getNakafaAgentExercise(
        `${EXERCISE_CONTENT_REF}/${firstExercise.number}`,
        firstExercise.number
      )
    );
    const missingExercise = await Effect.runPromise(
      getNakafaAgentExercise(EXERCISE_CONTENT_REF, 99_999)
    );
    const nonExercise = await Effect.runPromise(
      getNakafaAgentExercise("https://nakafa.com/en/quran/1")
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
    const error = await Effect.runPromise(
      Effect.match(
        getNakafaAgentExercise(EXERCISE_CONTENT_REF, undefined, () =>
          Effect.fail(
            new NakafaAgentDataReadError({
              cause: "broken",
              message: "Unable to read Nakafa exercise content.",
            })
          )
        ),
        {
          onFailure: (failure) => failure,
          onSuccess: () => null,
        }
      )
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });

  it("fails with a typed read error when the exercise result schema rejects output", async () => {
    const error = await Effect.runPromise(
      Effect.match(
        decodeNakafaAgentExerciseResult({
          ...buildNakafaContentRef("en", EXERCISE_ROUTE, "exercises"),
          count: 1,
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
