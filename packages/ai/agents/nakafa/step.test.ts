import {
  prepareAnswerFromNakafaEvidenceStep,
  prepareExerciseStep,
  prepareReadStep,
  selectExerciseRef,
  shouldAnswerFromNakafaEvidence,
  shouldReadAfterSearch,
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

const subjectResult = {
  count: 1,
  has_more: false,
  items: [
    {
      content_id:
        "id/subject/high-school/11/mathematics/function-modeling/rational-function",
      description: "Pelajari fungsi rasional.",
      locale: "id",
      markdown_url:
        "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function.md",
      route:
        "subject/high-school/11/mathematics/function-modeling/rational-function",
      section: "subject",
      title: "Fungsi Rasional",
      url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
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
      [{ role: "user", content: "beri latihan fungsi rasional" }],
      false
    );

    if (!step) {
      throw new Error("Expected a forced exercise step.");
    }

    expect(step.activeTools).toEqual(["exercise"]);
    expect(step.toolChoice).toEqual({ toolName: "exercise", type: "tool" });
    expect(step.messages[0]).toEqual(
      expect.objectContaining({
        content: "beri latihan fungsi rasional",
        role: "user",
      })
    );
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining(exerciseResult.items[0].content_id),
        role: "user",
      })
    );
  });

  it("does not force exercise when there is no pending ref or exercise already ran", () => {
    const messages = [
      { role: "user", content: "beri latihan fungsi rasional" },
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

  it("requires full content reads after lesson search results", () => {
    const shouldReadSubject = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
        section: "subject",
      },
      subjectResult
    );
    const shouldReadBroad = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
      },
      subjectResult
    );

    expect(shouldReadSubject).toBe(true);
    expect(shouldReadBroad).toBe(true);
  });

  it("does not require content reads for exercise, quran, empty, or failed searches", () => {
    const exerciseSearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "fungsi rasional",
        section: "exercises",
      },
      exerciseResult
    );
    const quranSearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "al fatihah",
        section: "quran",
      },
      {
        ...subjectResult,
        items: [{ ...subjectResult.items[0], section: "quran" }],
      }
    );
    const emptySearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "tidak ada",
        section: "subject",
      },
      {
        ...subjectResult,
        count: 0,
        items: [],
      }
    );
    const failedSearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        query: "tidak ada",
        section: "subject",
      },
      null
    );

    expect(exerciseSearch).toBe(false);
    expect(quranSearch).toBe(false);
    expect(emptySearch).toBe(false);
    expect(failedSearch).toBe(false);
  });

  it("forces read for one step when content search evidence is pending", () => {
    const step = prepareReadStep(
      true,
      [{ role: "user", content: "jelaskan fungsi rasional" }],
      false
    );

    if (!step) {
      throw new Error("Expected a forced read step.");
    }

    expect(step.activeTools).toEqual(["read"]);
    expect(step.toolChoice).toEqual({ toolName: "read", type: "tool" });
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Call the read tool now"),
        role: "user",
      })
    );
  });

  it("does not force read when there is no pending content or read already ran", () => {
    const messages = [
      { role: "user", content: "jelaskan fungsi rasional" },
    ] satisfies Parameters<typeof prepareReadStep>[1];
    const missingContent = prepareReadStep(false, messages, false);
    const alreadyRan = prepareReadStep(true, messages, true);

    expect(missingContent).toBeUndefined();
    expect(alreadyRan).toBeUndefined();
  });

  it("turns off tools after repeated content search calls", () => {
    const steps = [
      { toolCalls: [{ toolName: "search" }] },
      { toolCalls: [{ toolName: "taxonomy" }] },
      { toolCalls: [{ toolName: "search" }] },
      { toolCalls: [{ toolName: "search" }] },
      { toolCalls: [{ toolName: "search" }] },
    ];

    const answerStep = prepareAnswerFromNakafaEvidenceStep(
      [{ role: "user", content: "cari materi fungsi rasional" }],
      steps
    );

    if (!answerStep) {
      throw new Error("Expected a final answer step.");
    }

    expect(shouldAnswerFromNakafaEvidence(steps)).toBe(true);
    expect(answerStep.toolChoice).toBe("none");
    expect(answerStep.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Do not call another Nakafa tool"),
        role: "user",
      })
    );
  });

  it("keeps tools available while discovery is still below the loop guard", () => {
    const answerStep = prepareAnswerFromNakafaEvidenceStep(
      [{ role: "user", content: "cari materi fungsi rasional" }],
      [
        { toolCalls: [{ toolName: "search" }] },
        { toolCalls: [{ toolName: "taxonomy" }] },
        { toolCalls: [{ toolName: "search" }] },
      ]
    );

    expect(answerStep).toBeUndefined();
  });
});
