import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { flagTryoutQuestion } from "@/components/tryout/runtime/flag";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";
import { makeTryoutQuestion } from "@/test/tryout";

const attemptId = Schema.decodeUnknownSync(Id("tryoutAttempts"));
const placementId = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"));

/** A running section that holds `questions`. */
function makeRuntime(
  questions: readonly TryoutRuntimeQuestion[]
): TryoutSectionRuntime {
  return {
    attemptId: attemptId("attempt"),
    expiresAt: 2000,
    questions: [...questions],
    section: {
      answeredCount: 0,
      completedAt: null,
      endReason: null,
      expiresAt: 2000,
      score: null,
      sectionKey: "section",
      startedAt: 1000,
      status: "in-progress",
      totalQuestions: questions.length,
    },
  };
}

describe("flagTryoutQuestion", () => {
  it("flags only the named question and keeps the rest of the section", () => {
    const first = makeTryoutQuestion("a");
    const second = makeTryoutQuestion("b");
    const runtime = makeRuntime([first, second]);

    expect(
      flagTryoutQuestion(runtime, {
        flagged: true,
        placementId: second.placementId,
      })
    ).toEqual({ ...runtime, questions: [first, { ...second, flagged: true }] });
  });

  it("takes a flag off", () => {
    const flagged = makeTryoutQuestion("a", { flagged: true });

    expect(
      flagTryoutQuestion(makeRuntime([flagged]), {
        flagged: false,
        placementId: flagged.placementId,
      })?.questions
    ).toEqual([{ ...flagged, flagged: false }]);
  });

  it("leaves a section that does not hold the question as the server sent it", () => {
    expect(
      flagTryoutQuestion(makeRuntime([makeTryoutQuestion("a")]), {
        flagged: true,
        placementId: placementId("elsewhere"),
      })
    ).toBeNull();
  });
});
