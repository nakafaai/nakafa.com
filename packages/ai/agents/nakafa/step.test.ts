import {
  prepareExerciseStep,
  selectExerciseRef,
} from "@repo/ai/agents/nakafa/step";
import type { NakafaAgentSearchResult } from "@repo/contents/_lib/agent/schema/search";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

const exerciseResult = {
  count: 1,
  has_more: false,
  items: [
    {
      content_id:
        "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
      description: "Latihan fungsi rasional.",
      locale: "id",
      markdown_url:
        "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11.md",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
      section: "exercises",
      title: "Soal 11",
      url: "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
    },
  ],
  limit: 1,
  next_offset: null,
  offset: 0,
} satisfies NakafaAgentSearchResult;

describe("Nakafa agent step state", () => {
  it("selects the first exercise result after exercise-scoped search", () => {
    const ref = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
        section: "exercises",
      },
      exerciseResult
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected an exercise reference.");
    }

    const exercise = exerciseResult.items[0];

    if (!exercise) {
      throw new Error("Expected an exercise search result.");
    }

    expect(ref.value).toBe(exercise.content_id);
  });

  it("does not select exercises from broad or empty searches", () => {
    const broadSearch = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
      },
      exerciseResult
    );
    const emptySearch = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
        section: "exercises",
      },
      {
        ...exerciseResult,
        count: 0,
        items: [],
      }
    );
    const failedSearch = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
        section: "exercises",
      },
      null
    );

    expect(Option.isNone(broadSearch)).toBe(true);
    expect(Option.isNone(emptySearch)).toBe(true);
    expect(Option.isNone(failedSearch)).toBe(true);
  });

  it("forces exercise for one step when an exercise reference is pending", () => {
    const step = prepareExerciseStep(
      Option.some(exerciseResult.items[0].content_id),
      [{ role: "user", content: "tampilkan soal fungsi rasional" }],
      false
    );

    if (!step) {
      throw new Error("Expected a forced exercise step.");
    }

    expect(step.activeTools).toEqual(["exercise"]);
    expect(step.toolChoice).toEqual({ toolName: "exercise", type: "tool" });
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining(exerciseResult.items[0].content_id),
        role: "user",
      })
    );
  });

  it("does not force exercise when there is no pending ref or exercise already ran", () => {
    const messages = [
      { role: "user", content: "tampilkan soal fungsi rasional" },
    ] satisfies Parameters<typeof prepareExerciseStep>[1];
    const missingRef = prepareExerciseStep(Option.none(), messages, false);
    const alreadyRan = prepareExerciseStep(
      Option.some(exerciseResult.items[0].content_id),
      messages,
      true
    );

    expect(missingRef).toBeUndefined();
    expect(alreadyRan).toBeUndefined();
  });
});
