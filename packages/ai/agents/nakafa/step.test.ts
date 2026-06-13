import {
  prepareAnswerFromNakafaEvidenceStep,
  prepareExerciseStep,
  prepareReadStep,
  prepareTaxonomyAnswerStep,
  selectExerciseRef,
  shouldAnswerFromNakafaEvidence,
  shouldReadAfterSearch,
} from "@repo/ai/agents/nakafa/step";
import {
  buildNakafaContentRef,
  createNakafaContentRefFromGraphProjection,
} from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentSection } from "@repo/contents/_lib/agent/schema/ref";
import type { NakafaAgentSearchResult } from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

/** Builds a typed Nakafa content summary fixture from canonical route parts. */
function contentSummary({
  description,
  excerpt,
  locale,
  route,
  section,
  title,
}: {
  description: string;
  excerpt?: string;
  locale: Locale;
  route: string;
  section: NakafaAgentSection;
  title: string;
}) {
  return {
    ...buildNakafaContentRef(locale, route, section),
    description,
    excerpt: excerpt ?? description,
    title,
  } satisfies NakafaAgentSearchResult["items"][number];
}

/** Builds a search result fixture whose graph IDs intentionally differ by route. */
function detachedExerciseSummary({
  contentId,
  description,
  route,
  title,
}: {
  contentId: string;
  description: string;
  route: string;
  title: string;
}) {
  const ref = createNakafaContentRefFromGraphProjection({
    alignmentId: contentId.replace("asset:", "alignment:"),
    assetId: contentId,
    conceptId: contentId.replace("asset:", "concept:"),
    content_id: contentId,
    learningObjectId: contentId.replace("asset:", "lo:"),
    lensId: contentId.replace("asset:", "lens:"),
    locale: "id",
    route,
    section: "exercises",
  });

  if (Option.isNone(ref)) {
    throw new Error("Expected a valid detached exercise graph ref.");
  }

  return {
    ...ref.value,
    description,
    excerpt: description,
    title,
  } satisfies NakafaAgentSearchResult["items"][number];
}

const exerciseResult = {
  count: 1,
  has_more: false,
  items: [
    contentSummary({
      description: "Latihan fungsi rasional.",
      locale: "id",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
      section: "exercises",
      title: "Soal 11",
    }),
  ],
  limit: 1,
  offset: 0,
} satisfies NakafaAgentSearchResult;

const exerciseSetResult = contentSummary({
  description: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2.",
  locale: "id",
  route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
  section: "exercises",
  title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
});

const subjectResult = {
  count: 1,
  has_more: false,
  items: [
    contentSummary({
      description: "Pelajari fungsi rasional.",
      locale: "id",
      route:
        "subject/high-school/11/mathematics/function-modeling/rational-function",
      section: "subject",
      title: "Fungsi Rasional",
    }),
  ],
  limit: 1,
  offset: 0,
} satisfies NakafaAgentSearchResult;

describe("Nakafa agent step state", () => {
  it("selects the returned exercise graph ref after exercise-scoped search", () => {
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

    expect(ref.value).toBe(exerciseResult.items[0].content_id);
  });

  it("preserves question-level graph refs when no set-level hit is returned", () => {
    const firstResult = contentSummary({
      description: "Latihan fungsi rasional.",
      locale: "id",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/15",
      section: "exercises",
      title: "Soal 15",
    });
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

    expect(ref.value).toBe(firstResult.content_id);
  });

  it("prefers returned set-level graph refs for broad exercise requests", () => {
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

  it("does not rebuild detached set graph IDs from route projections", () => {
    const question = detachedExerciseSummary({
      contentId: "asset:id:detached:exercise:set-2:q15",
      description: "Detached graph question.",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/15",
      title: "Detached Question 15",
    });
    const set = detachedExerciseSummary({
      contentId: "asset:id:detached:exercise:set-2",
      description: "Detached graph set.",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
      title: "Detached Set 2",
    });
    const routeDerivedSet = buildNakafaContentRef("id", set.route, "exercises");
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
        items: [question, set],
        limit: 20,
      }
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected a detached set graph reference.");
    }

    expect(ref.value).toBe(set.content_id);
    expect(ref.value).not.toBe(routeDerivedSet.content_id);
  });

  it("falls back to the returned question graph ID without a set-level hit", () => {
    const question = detachedExerciseSummary({
      contentId: "asset:id:detached:exercise:set-2:q11",
      description: "Detached graph question.",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
      title: "Detached Question 11",
    });
    const routeDerivedSet = buildNakafaContentRef(
      "id",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
      "exercises"
    );
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
        count: 1,
        items: [question],
        limit: 20,
      }
    );

    if (Option.isNone(ref)) {
      throw new Error("Expected a detached question graph reference.");
    }

    expect(ref.value).toBe(question.content_id);
    expect(ref.value).not.toBe(routeDerivedSet.content_id);
  });

  it("keeps search ordering instead of parsing the user request locally", () => {
    const mathematicalReasoning = contentSummary({
      description: "SMA SNBT Penalaran Matematika Try Out 2026 Set 2 Nomor 11",
      locale: "id",
      route:
        "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-2/11",
      section: "exercises",
      title: "SNBT Penalaran Matematika Try Out 2026 Set 2 Soal 11",
    });
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

    expect(ref.value).toBe(mathematicalReasoning.content_id);
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

    expect(ref.value).toBe(exerciseResult.items[0].content_id);
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

    expect(ref.value).toBe(exerciseResult.items[0].content_id);
  });

  it("keeps stable search order when exercise scores tie", () => {
    const secondResult = contentSummary({
      description: "Latihan fungsi rasional.",
      locale: "id",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/12",
      section: "exercises",
      title: "Soal 12",
    });
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

    expect(ref.value).toBe(exerciseResult.items[0].content_id);
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
    const previousMessages = [
      {
        role: "user",
        content: "Aku mau soal nomor 11 dari set ini.",
      },
    ] satisfies Parameters<typeof prepareExerciseStep>[1];
    const step = prepareExerciseStep(
      Option.some(exerciseResult.items[0].content_id),
      previousMessages,
      false
    );

    if (!step) {
      throw new Error("Expected a forced exercise step.");
    }

    expect(step.activeTools).toEqual(["exercise"]);
    expect(step.toolChoice).toEqual({ toolName: "exercise", type: "tool" });
    expect(step.messages).toHaveLength(2);
    expect(step.messages[0]).toBe(previousMessages[0]);
    expect(step.messages[1]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining(exerciseResult.items[0].content_id),
        role: "user",
      })
    );
    expect(step.messages[1]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Call exactly one exercise tool"),
        role: "user",
      })
    );
    expect(step.messages[1]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining(
          "Do not call exercise with any other content_ref"
        ),
        role: "user",
      })
    );
    expect(step.messages[1]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Include exercise_number only when"),
        role: "user",
      })
    );
  });

  it("does not force exercise when there is no pending ref or exercise already ran", () => {
    const missingRef = prepareExerciseStep(Option.none(), [], false);
    const alreadyRan = prepareExerciseStep(
      Option.some(exerciseResult.items[0].content_id),
      [],
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
        items: [
          contentSummary({
            description: "Surah pembuka.",
            locale: "id",
            route: "quran/1",
            section: "quran",
            title: "Al-Fatihah",
          }),
        ],
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
