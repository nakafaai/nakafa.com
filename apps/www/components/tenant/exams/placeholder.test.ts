import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  placeholderExamId,
  placeholderPromptId,
  placeholderQuestionId,
} from "@/components/tenant/exams/placeholder";

describe("placeholder ids", () => {
  it.effect("give each saved-later exam its own identifier", () =>
    Effect.gen(function* () {
      const first = yield* placeholderExamId;
      const second = yield* placeholderExamId;

      expect(first).not.toBe(second);
    })
  );

  it.effect(
    "give a question and its prompt identifiers of their own tables",
    () =>
      Effect.gen(function* () {
        const question = yield* placeholderQuestionId;
        const prompt = yield* placeholderPromptId;

        expect(question).toEqual(expect.any(String));
        expect(prompt).toEqual(expect.any(String));
        expect(question).not.toBe(prompt);
      })
  );
});
