import {
  prepareAnswerFromNakafaEvidenceStep,
  prepareExerciseStep,
  prepareReadStep,
  prepareTaxonomyAnswerStep,
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

const exerciseSetResult = {
  ...exerciseResult.items[0],
  content_id:
    "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
  description: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2.",
  markdown_url:
    "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2.md",
  route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
  title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
  url: "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
};

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
  it("selects the parent exercise set after broad exercise-scoped search", () => {
    const ref = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
        section: "exercises",
      },
      exerciseResult
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected an exercise reference.");
    }

    expect(ref.value).toBe(exerciseSetResult.content_id);
  });

  it("normalizes question-level search hits to their parent exercise set", () => {
    const firstResult = {
      ...exerciseResult.items[0],
      content_id:
        "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/15",
      markdown_url:
        "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/15.md",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/15",
      title: "Soal 15",
      url: "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/15",
    };
    const ref = selectExerciseRef(
      {
        limit: 20,
        locale: "id",
        offset: 0,
        queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
        section: "exercises",
      },
      {
        ...exerciseResult,
        count: 2,
        items: [firstResult, exerciseResult.items[0]],
        limit: 20,
      }
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected an exercise set reference.");
    }

    expect(ref.value).toBe(exerciseSetResult.content_id);
  });

  it("prefers set-level exercise refs for broad exercise requests", () => {
    const ref = selectExerciseRef(
      {
        limit: 20,
        locale: "id",
        offset: 0,
        queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
        section: "exercises",
      },
      {
        ...exerciseResult,
        count: 2,
        items: [exerciseResult.items[0], exerciseSetResult],
        limit: 20,
      }
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected a set-level exercise reference.");
    }

    expect(ref.value).toBe(exerciseSetResult.content_id);
  });

  it("keeps search ordering instead of parsing the user request locally", () => {
    const mathematicalReasoning = {
      ...exerciseResult.items[0],
      content_id:
        "id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-2/11",
      description: "SMA SNBT Penalaran Matematika Try Out 2026 Set 2 Nomor 11",
      markdown_url:
        "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-2/11.md",
      route:
        "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-2/11",
      title: "SNBT Penalaran Matematika Try Out 2026 Set 2 Soal 11",
      url: "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-2/11",
    };
    const mathematicalReasoningSet =
      "id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-2";
    const quantitativeKnowledge = {
      ...exerciseResult.items[0],
      description:
        "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 Nomor 11",
      title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 Soal 11",
    };
    const ref = selectExerciseRef(
      {
        limit: 20,
        locale: "id",
        offset: 0,
        queries: ["SNBT 2026 set 2 nomor 11"],
        section: "exercises",
      },
      {
        ...exerciseResult,
        count: 2,
        items: [mathematicalReasoning, quantitativeKnowledge],
        limit: 20,
      }
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected the first exercise reference.");
    }

    expect(ref.value).toBe(mathematicalReasoningSet);
  });

  it("keeps search order when no selection tokens are available", () => {
    const ref = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: [],
        section: "exercises",
      },
      exerciseResult
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected the first exercise reference.");
    }

    expect(ref.value).toBe(exerciseSetResult.content_id);
  });

  it("keeps search order when the search input does not include query text", () => {
    const ref = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        section: "exercises",
      },
      exerciseResult
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected the first exercise reference.");
    }

    expect(ref.value).toBe(exerciseSetResult.content_id);
  });

  it("keeps stable search order when exercise scores tie", () => {
    const secondResult = {
      ...exerciseResult.items[0],
      content_id:
        "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/12",
      markdown_url:
        "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/12.md",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/12",
      title: "Soal 12",
      url: "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/12",
    };
    const ref = selectExerciseRef(
      {
        limit: 2,
        locale: "id",
        offset: 0,
        queries: ["SNBT Pengetahuan Kuantitatif"],
        section: "exercises",
      },
      {
        ...exerciseResult,
        count: 2,
        items: [exerciseResult.items[0], secondResult],
        limit: 2,
      }
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected the first tied exercise reference.");
    }

    expect(ref.value).toBe(exerciseSetResult.content_id);
  });

  it("does not select exercises from broad or empty searches", () => {
    const broadSearch = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
      },
      exerciseResult
    );
    const emptySearch = selectExerciseRef(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
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
        queries: ["fungsi rasional"],
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
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Include exercise_number only when"),
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
        queries: ["fungsi rasional"],
        section: "subject",
      },
      subjectResult
    );
    const shouldReadBroad = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
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
        queries: ["fungsi rasional"],
        section: "exercises",
      },
      exerciseResult
    );
    const quranSearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["al fatihah"],
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
        queries: ["tidak ada"],
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
        queries: ["tidak ada"],
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

  it("turns off tools after taxonomy-only evidence is available", () => {
    const step = prepareTaxonomyAnswerStep(
      [{ role: "user", content: "struktur latihan yang tersedia" }],
      [{ toolCalls: [{ toolName: "taxonomy" }] }]
    );

    if (!step) {
      throw new Error("Expected a taxonomy answer step.");
    }

    expect(step.toolChoice).toBe("none");
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Use the Nakafa taxonomy result"),
        role: "user",
      })
    );
  });

  it("keeps tools available when taxonomy is not the only evidence", () => {
    const step = prepareTaxonomyAnswerStep(
      [{ role: "user", content: "cari latihan snbt" }],
      [{ toolCalls: [{ toolName: "taxonomy" }, { toolName: "search" }] }]
    );

    expect(step).toBeUndefined();
  });

  it("keeps tools available when no taxonomy evidence exists", () => {
    const step = prepareTaxonomyAnswerStep(
      [{ role: "user", content: "cari latihan snbt" }],
      [{ toolCalls: [{ toolName: "search" }] }]
    );

    expect(step).toBeUndefined();
  });
});
