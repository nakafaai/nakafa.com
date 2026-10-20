import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  applyOptimisticTryoutResponse,
  assignCategorySelection,
  nextTryoutResponseVersion,
  toggleMultipleChoiceSelection,
  tryoutSubmitFailureOf,
} from "@/components/tryout/runtime/response/state";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

const NOW = 1_783_425_600_000;
const decodePlacementId = Schema.decodeUnknownSync(
  Id("tryoutAttemptPlacements")
);
const decodeAttemptId = Schema.decodeUnknownSync(Id("tryoutAttempts"));

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
          version: 1,
        },
        NOW
      )?.section.answeredCount
    ).toBe(1);

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
        version: 1,
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
        version: 2,
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
      {
        placementId: runtime.questions[0].placementId,
        selection: null,
        version: 3,
      },
      NOW + 2000
    );
    expect(cleared?.questions[0].response).toBeNull();
    expect(cleared?.section.answeredCount).toBe(0);
  });

  it("numbers each write after the version its question shows", () => {
    const question = makeMultipleQuestion();
    expect(nextTryoutResponseVersion(question)).toBe(1);
    expect(
      nextTryoutResponseVersion({
        ...question,
        response: makeResponse({
          kind: "multiple-choice",
          optionKeys: ["option-1"],
        }),
      })
    ).toBe(1);
    expect(nextTryoutResponseVersion({ ...question, version: 4 })).toBe(5);
  });

  it("shows the version of the latest write, so the next one follows it", () => {
    const first = writeNext(makeRuntime(makeMultipleQuestion()), ["option-1"]);
    expect(first.questions[0].version).toBe(1);
    const second = writeNext(first, ["option-1", "option-2"]);
    expect(second.questions[0].version).toBe(2);
    expect(nextTryoutResponseVersion(second.questions[0])).toBe(3);
  });

  it("keeps the version when an answer is cleared, so the next write follows the clear", () => {
    const answered = writeNext(makeRuntime(makeMultipleQuestion()), [
      "option-1",
    ]);
    const cleared = applyOptimisticTryoutResponse(
      answered,
      {
        placementId: answered.questions[0].placementId,
        selection: null,
        version: nextTryoutResponseVersion(answered.questions[0]),
      },
      NOW
    );
    if (!cleared) {
      throw new Error("Expected an optimistic clear.");
    }
    expect(cleared.questions[0]).toMatchObject({ response: null, version: 2 });
    expect(nextTryoutResponseVersion(cleared.questions[0])).toBe(3);
  });

  it("leaves a stale refusal silent, tells an ended attempt, and reports any other failure", () => {
    const endedCodes: readonly Parameters<typeof tryoutSubmitFailureOf>[0][] = [
      "TRYOUT_EXPIRED",
      "TRYOUT_ATTEMPT_NOT_ACTIVE",
      "TRYOUT_SECTION_NOT_ACTIVE",
    ];
    expect(tryoutSubmitFailureOf("TRYOUT_RESPONSE_STALE")).toBe("stale");
    for (const code of endedCodes) {
      expect(tryoutSubmitFailureOf(code)).toBe("ended");
    }
    expect(tryoutSubmitFailureOf("TRYOUT_RESPONSE_FAILED")).toBe("error");
    expect(tryoutSubmitFailureOf(undefined)).toBe("error");
  });

  it("rejects missing placements and invalid optimistic selections", () => {
    const runtime = makeRuntime(makeMultipleQuestion());
    expect(
      applyOptimisticTryoutResponse(
        runtime,
        {
          placementId: decodePlacementId("missing"),
          selection: null,
          version: 1,
        },
        NOW
      )
    ).toBeNull();
    expect(
      applyOptimisticTryoutResponse(
        runtime,
        {
          placementId: runtime.questions[0].placementId,
          selection: { kind: "single-choice", optionKey: "option-1" },
          version: 1,
        },
        NOW
      )
    ).toBeNull();
    expect(
      applyOptimisticTryoutResponse(
        makeRuntime(makeSingleQuestion()),
        {
          placementId: runtime.questions[0].placementId,
          selection: { kind: "single-choice", optionKey: "missing" },
          version: 1,
        },
        NOW
      )
    ).toBeNull();
    for (const optionKeys of [[], ["option-1", "option-1"], ["missing"]]) {
      expect(
        applyOptimisticTryoutResponse(
          runtime,
          {
            placementId: runtime.questions[0].placementId,
            selection: { kind: "multiple-choice", optionKeys },
            version: 1,
          },
          NOW
        )
      ).toBeNull();
    }
    const categoryRuntime = makeRuntime(makeCategoryQuestion());
    for (const assignments of [
      [{ categoryKey: "missing", statementKey: "statement-1" }],
      [{ categoryKey: "category-1", statementKey: "missing" }],
      [
        { categoryKey: "category-1", statementKey: "statement-1" },
        { categoryKey: "category-2", statementKey: "statement-1" },
      ],
    ]) {
      expect(
        applyOptimisticTryoutResponse(
          categoryRuntime,
          {
            placementId: categoryRuntime.questions[0].placementId,
            selection: { assignments, kind: "category" },
            version: 1,
          },
          NOW
        )
      ).toBeNull();
    }
  });
});

function makeMultipleQuestion(): TryoutRuntimeQuestion {
  return {
    contentHash: "content-hash",
    placementId: decodePlacementId("placement"),
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
      options: [responseOption("option-1", 1), responseOption("option-2", 2)],
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

/** Writes a multiple-choice answer to the only question of a runtime, numbered as the client numbers it. */
function writeNext(runtime: TryoutSectionRuntime, optionKeys: string[]) {
  const [question] = runtime.questions;
  const applied = applyOptimisticTryoutResponse(
    runtime,
    {
      placementId: question.placementId,
      selection: { kind: "multiple-choice", optionKeys },
      version: nextTryoutResponseVersion(question),
    },
    NOW
  );
  if (!applied) {
    throw new Error("Expected an optimistic multiple-choice response.");
  }
  return applied;
}

function makeRuntime(question: TryoutRuntimeQuestion): TryoutSectionRuntime {
  return {
    attemptId: decodeAttemptId("attempt"),
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
