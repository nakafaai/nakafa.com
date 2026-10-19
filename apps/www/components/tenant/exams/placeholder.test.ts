import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  isPlaceholderId,
  placeholderExamId,
  placeholderPromptId,
  placeholderQuestionId,
  placeholderSittingId,
} from "@/components/tenant/exams/placeholder";

describe("placeholder ids", () => {
  it.effect("give each saved-later exam its own identifier", () =>
    Effect.gen(function* () {
      const first = yield* placeholderExamId;
      const second = yield* placeholderExamId;

      expect(first).not.toBe(second);
    })
  );

  it.effect("give a room identifier of its own, which is a placeholder", () =>
    Effect.gen(function* () {
      const room = yield* placeholderSittingId;

      expect(isPlaceholderId(room)).toBe(true);
      expect(room).not.toBe(yield* placeholderSittingId);
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

  it.effect("tell a placeholder apart from an ID the server issues", () =>
    Effect.gen(function* () {
      const prompt = yield* placeholderPromptId;

      expect(isPlaceholderId(prompt)).toBe(true);
      expect(isPlaceholderId("k57b3h0e8s7a0z1x2c3v4b5n6m7q8w9e")).toBe(false);
    })
  );
});
