import { describe, expect, it } from "@effect/vitest";
import {
  applyOptimisticTryoutResponse,
  assignCategorySelection,
  toggleMultipleChoiceSelection,
} from "@/components/tryout/runtime/response/state";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

const NOW = 1_783_425_600_000;

describe("try-out response state", () => {
  it("adds and removes multiple choices in authored order", () => {
    const question = makeMultipleQuestion();
    expect(
      toggleMultipleChoiceSelection(responseState(question), "option-2")
    ).toEqual({
      kind: "multiple-choice",
      optionKeys: ["option-2"],
    });
    const selected = {
      ...question,
      response: makeResponse({
        kind: "multiple-choice",
        optionKeys: ["option-2"],
      }),
    };
    expect(
      toggleMultipleChoiceSelection(responseState(selected), "option-1")
    ).toEqual({
      kind: "multiple-choice",
      optionKeys: ["option-1", "option-2"],
    });
    expect(
      toggleMultipleChoiceSelection(responseState(selected), "option-2")
    ).toBeNull();
    expect(
      toggleMultipleChoiceSelection(
        responseState(makeCategoryQuestion()),
        "option-1"
      )
    ).toBeNull();
  });

  it("replaces and canonically orders category assignments", () => {
    const question = makeCategoryQuestion();
    const first = assignCategorySelection(
      responseState(question),
      "statement-2",
      "category-1"
    );
    expect(first).toEqual({
      assignments: [{ categoryKey: "category-1", statementKey: "statement-2" }],
      kind: "category",
    });
    if (!first) {
      throw new Error("Expected one category assignment.");
    }
    expect(
      assignCategorySelection(
        responseState({ ...question, response: makeResponse(first) }),
        "statement-1",
        "category-2"
      )
    ).toEqual({
      assignments: [
        { categoryKey: "category-2", statementKey: "statement-1" },
        { categoryKey: "category-1", statementKey: "statement-2" },
      ],
      kind: "category",
    });
    expect(
      assignCategorySelection(
        responseState(makeMultipleQuestion()),
        "statement-1",
        "x"
      )
    ).toBeNull();
  });

  it("counts only complete optimistic responses and supports clearing", () => {
    const multipleRuntime = makeRuntime(makeMultipleQuestion());
    expect(
      applyOptimisticTryoutResponse(
        multipleRuntime,
        {
          placementId: multipleRuntime.questions[0].placementId,
          selection: {
            kind: "multiple-choice",
            optionKeys: ["option-1"],
          },
        },
        NOW
      )?.section.answeredCount
    ).toBe(1);

    const legacyRuntime = makeRuntime(makeSingleQuestion());
    expect(
      applyOptimisticTryoutResponse(
        legacyRuntime,
        {
          placementId: legacyRuntime.questions[0].placementId,
          selectedOptionId: "option-1",
        },
        NOW
      )?.questions[0].response?.selection
    ).toEqual({ kind: "single-choice", optionKey: "option-1" });

    const runtime = makeRuntime(makeCategoryQuestion());
    const partial = applyOptimisticTryoutResponse(
      runtime,
      {
        placementId: runtime.questions[0].placementId,
        selection: {
          assignments: [
            { categoryKey: "category-1", statementKey: "statement-1" },
          ],
          kind: "category",
        },
      },
      NOW
    );
    expect(partial?.section.answeredCount).toBe(0);
    expect(partial?.questions[0].response).toMatchObject({
      answeredAt: NOW,
      isComplete: false,
    });

    if (!partial) {
      throw new Error("Expected an optimistic category response.");
    }
    const complete = applyOptimisticTryoutResponse(
      partial,
      {
        placementId: runtime.questions[0].placementId,
        selection: {
          assignments: [
            { categoryKey: "category-1", statementKey: "statement-1" },
            { categoryKey: "category-2", statementKey: "statement-2" },
          ],
          kind: "category",
        },
      },
      NOW + 1000
    );
    expect(complete?.section.answeredCount).toBe(1);
    expect(complete?.questions[0].response).toMatchObject({
      answeredAt: NOW,
      isComplete: true,
      updatedAt: NOW + 1000,
    });

    if (!complete) {
      throw new Error("Expected a complete optimistic category response.");
    }
    const cleared = applyOptimisticTryoutResponse(
      complete,
      { placementId: runtime.questions[0].placementId, selection: null },
      NOW + 2000
    );
    expect(cleared?.questions[0].response).toBeNull();
    expect(cleared?.section.answeredCount).toBe(0);
  });

  it("rejects a missing placement or mismatched optimistic kind", () => {
    const runtime = makeRuntime(makeMultipleQuestion());
    expect(
      applyOptimisticTryoutResponse(
        runtime,
        { placementId: "missing" as never, selection: null },
        NOW
      )
    ).toBeNull();
    expect(
      applyOptimisticTryoutResponse(
        runtime,
        {
          placementId: runtime.questions[0].placementId,
          selection: { kind: "single-choice", optionKey: "option-1" },
        },
        NOW
      )
    ).toBeNull();
    expect(
      applyOptimisticTryoutResponse(
        runtime,
        { placementId: runtime.questions[0].placementId },
        NOW
      )
    ).toBeNull();
    expect(
      applyOptimisticTryoutResponse(
        runtime,
        {
          placementId: runtime.questions[0].placementId,
          selectedOptionId: "option-1",
          selection: {
            kind: "multiple-choice",
            optionKeys: ["option-1"],
          },
        },
        NOW
      )
    ).toBeNull();
  });
});

function makeMultipleQuestion(): TryoutRuntimeQuestion {
  return {
    choices: [],
    contentHash: "content-hash",
    placementId: "placement" as TryoutRuntimeQuestion["placementId"],
    questionOrder: 1,
    response: null,
    responseSpec: {
      kind: "multiple-choice",
      options: [responseOption("option-1", 1), responseOption("option-2", 2)],
    },
    sourcePath: "question.mdx",
    sourceRevision: "revision",
  };
}

function makeSingleQuestion(): TryoutRuntimeQuestion {
  return {
    ...makeMultipleQuestion(),
    responseSpec: {
      kind: "single-choice",
      options: [responseOption("option-1", 1)],
    },
  };
}

function makeCategoryQuestion(): TryoutRuntimeQuestion {
  return {
    ...makeMultipleQuestion(),
    responseSpec: {
      categories: [
        responseCategory("category-1", 1),
        responseCategory("category-2", 2),
      ],
      kind: "category",
      statements: [
        responseStatement("statement-1", 1),
        responseStatement("statement-2", 2),
      ],
    },
  };
}

function responseOption(optionKey: string, order: number) {
  return {
    label: optionKey,
    optionKey,
    order,
  };
}

function responseCategory(categoryKey: string, order: number) {
  return {
    categoryKey,
    label: categoryKey,
    order,
  };
}

function responseStatement(statementKey: string, order: number) {
  return {
    label: statementKey,
    order,
    statementKey,
  };
}

function responseState(question: TryoutRuntimeQuestion) {
  return {
    responseSpec: question.responseSpec,
    selection: question.response?.selection ?? null,
  };
}

function makeResponse(
  selection: NonNullable<TryoutRuntimeQuestion["response"]>["selection"]
) {
  return {
    answeredAt: NOW,
    isComplete: false,
    selection,
    updatedAt: NOW,
  };
}

function makeRuntime(question: TryoutRuntimeQuestion): TryoutSectionRuntime {
  return {
    attemptId: "attempt" as TryoutSectionRuntime["attemptId"],
    expiresAt: NOW + 1000,
    questions: [question],
    section: {
      answeredCount: 0,
      completedAt: null,
      endReason: null,
      expiresAt: NOW + 1000,
      score: null,
      sectionKey: "section",
      startedAt: NOW,
      status: "in-progress",
      totalQuestions: 1,
    },
  };
}
