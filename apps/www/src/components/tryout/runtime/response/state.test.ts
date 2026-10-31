import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  applyOptimisticTryoutResponse,
  isAnsweredQuestion,
  matchesKey,
  nextTryoutResponseVersion,
  tryoutSubmitFailureOf,
} from "@/components/tryout/runtime/response/state";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import { makeTryoutQuestion } from "@/test/tryout";

const NOW = 1_783_425_600_000;
const decodeAttemptId = Schema.decodeUnknownSync(Id("tryoutAttempts"));

/** A response the server stored for a question at `NOW - 1000`. */
const stored = (response: readonly string[]) => ({
  answeredAt: NOW - 1000,
  response,
  updatedAt: NOW - 1000,
});

/** A running section of two questions, the first answered. */
function makeRuntime(): TryoutSectionRuntime {
  return {
    attemptId: decodeAttemptId("attempt"),
    expiresAt: NOW + 60_000,
    questions: [
      makeTryoutQuestion("first", {
        response: stored(["option-1"]),
        version: 2,
      }),
      makeTryoutQuestion("second", { questionOrder: 2 }),
    ],
    section: {
      answeredCount: 1,
      completedAt: null,
      endReason: null,
      expiresAt: NOW + 60_000,
      score: null,
      sectionKey: "verbal",
      startedAt: NOW - 60_000,
      status: "in-progress",
      totalQuestions: 2,
    },
  };
}

describe("nextTryoutResponseVersion", () => {
  it("numbers the first write one and every later one above the version shown", () => {
    expect(nextTryoutResponseVersion(makeTryoutQuestion("first"))).toBe(1);
    expect(
      nextTryoutResponseVersion(makeTryoutQuestion("first", { version: 4 }))
    ).toBe(5);
  });
});

describe("tryoutSubmitFailureOf", () => {
  it("tells a stale write, an ended attempt, and any other failure apart", () => {
    expect(tryoutSubmitFailureOf("TRYOUT_RESPONSE_STALE")).toBe("stale");
    expect(tryoutSubmitFailureOf("TRYOUT_EXPIRED")).toBe("ended");
    expect(tryoutSubmitFailureOf("TRYOUT_ATTEMPT_NOT_ACTIVE")).toBe("ended");
    expect(tryoutSubmitFailureOf("TRYOUT_SECTION_NOT_ACTIVE")).toBe("ended");
    expect(tryoutSubmitFailureOf("TRYOUT_RESPONSE_FAILED")).toBe("error");
    expect(tryoutSubmitFailureOf(undefined)).toBe("error");
  });
});

describe("isAnsweredQuestion", () => {
  it("counts a question as answered as the server counts its response", () => {
    expect(isAnsweredQuestion(makeTryoutQuestion("first"))).toBe(false);
    expect(
      isAnsweredQuestion(
        makeTryoutQuestion("first", { response: stored(["option-1"]) })
      )
    ).toBe(true);
    expect(
      isAnsweredQuestion(makeTryoutQuestion("first", { response: stored([]) }))
    ).toBe(false);
  });
});

describe("matchesKey", () => {
  it("matches a choice that holds the key's options and no other", () => {
    const key = {
      correct: ["option-1", "option-2"] as const,
      interaction: "choice",
      kind: "choice" as const,
    };
    expect(matchesKey(key, ["option-2", "option-1"])).toBe(true);
    expect(matchesKey(key, ["option-1"])).toBe(false);
    expect(matchesKey(key, ["option-1", "option-3"])).toBe(false);
  });

  it("matches a matrix that marks every statement in the key's column", () => {
    const key = {
      answers: [
        { column: "true", statement: "statement-1" },
        { column: "false", statement: "statement-2" },
      ] as const,
      interaction: "matrix",
      kind: "matrix" as const,
    };
    expect(
      matchesKey(key, {
        cells: [
          { column: "true", statement: "statement-1" },
          { column: "false", statement: "statement-2" },
        ],
      })
    ).toBe(true);
    expect(
      matchesKey(key, {
        cells: [
          { column: "true", statement: "statement-1" },
          { column: "true", statement: "statement-2" },
        ],
      })
    ).toBe(false);
    expect(
      matchesKey(key, {
        cells: [{ column: "true", statement: "statement-1" }],
      })
    ).toBe(false);
  });

  it("matches nothing for a key of a kind the corpus does not compile", () => {
    expect(
      matchesKey(
        { correct: "option-1", interaction: "gap", kind: "inlineChoice" },
        ["option-1"]
      )
    ).toBe(false);
  });
});

describe("applyOptimisticTryoutResponse", () => {
  it("answers a question with its version and counts it once", () => {
    const changed = applyOptimisticTryoutResponse(
      makeRuntime(),
      {
        placementId: makeTryoutQuestion("second").placementId,
        response: ["option-2"],
        version: 1,
      },
      NOW
    );
    expect(changed?.section.answeredCount).toBe(2);
    expect(changed?.questions[1]).toEqual(
      makeTryoutQuestion("second", {
        questionOrder: 2,
        response: { answeredAt: NOW, response: ["option-2"], updatedAt: NOW },
        version: 1,
      })
    );
  });

  it("changes an answer, keeping when it was first answered", () => {
    const changed = applyOptimisticTryoutResponse(
      makeRuntime(),
      {
        placementId: makeTryoutQuestion("first").placementId,
        response: ["option-2"],
        version: 3,
      },
      NOW
    );
    expect(changed?.section.answeredCount).toBe(1);
    expect(changed?.questions[0]?.response).toEqual({
      answeredAt: NOW - 1000,
      response: ["option-2"],
      updatedAt: NOW,
    });
  });

  it("clears an answer, keeping its version, and stops counting it", () => {
    const changed = applyOptimisticTryoutResponse(
      makeRuntime(),
      {
        placementId: makeTryoutQuestion("first").placementId,
        response: null,
        version: 3,
      },
      NOW
    );
    expect(changed?.section.answeredCount).toBe(0);
    expect(changed?.questions[0]).toEqual(
      makeTryoutQuestion("first", { response: null, version: 3 })
    );
  });

  it("changes nothing for a question the section does not hold", () => {
    expect(
      applyOptimisticTryoutResponse(
        makeRuntime(),
        {
          placementId: makeTryoutQuestion("other").placementId,
          response: ["option-1"],
          version: 1,
        },
        NOW
      )
    ).toBeNull();
  });
});
