import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

export const TRYOUT_NOW = 1_783_425_600_000;

/** Builds one unanswered single-choice runtime question with two options. */
export function makeTryoutQuestion(
  placementId: string,
  overrides: Partial<TryoutRuntimeQuestion> = {}
): TryoutRuntimeQuestion {
  return {
    contentHash: `content-${placementId}`,
    flagged: false,
    placementId: placementId as TryoutRuntimeQuestion["placementId"],
    questionOrder: 1,
    response: null,
    responseSpec: {
      kind: "single-choice",
      options: [
        { label: "Option 1", optionKey: "option-1", order: 1 },
        { label: "Option 2", optionKey: "option-2", order: 2 },
      ],
    },
    sourcePath: `${placementId}.mdx`,
    sourceRevision: "revision",
    ...overrides,
  };
}

/** Builds one running section runtime around the given questions. */
export function makeTryoutRuntime(
  questions: readonly TryoutRuntimeQuestion[]
): TryoutSectionRuntime {
  return {
    attemptId: "attempt" as TryoutSectionRuntime["attemptId"],
    expiresAt: TRYOUT_NOW + 1000,
    questions: [...questions],
    section: {
      answeredCount: 0,
      completedAt: null,
      endReason: null,
      expiresAt: TRYOUT_NOW + 1000,
      score: null,
      sectionKey: "section",
      startedAt: TRYOUT_NOW,
      status: "in-progress",
      totalQuestions: questions.length,
    },
  };
}
