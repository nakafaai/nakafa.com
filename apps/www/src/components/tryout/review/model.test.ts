import { describe, expect, it } from "@effect/vitest";
import {
  readsWhole,
  reviewCellsOf,
  verdictOfQuestion,
} from "@/components/tryout/review/model";
import { makeTryoutBody, makeTryoutQuestion } from "@/test/tryout";

/** A response the learner saved, with the grade a reader who may see it receives. */
const answered = (
  response: readonly string[],
  grade?: {
    readonly category: number;
    readonly ceiling: number;
    readonly status: "scored";
  }
) => ({
  response: {
    answeredAt: 1,
    response,
    updatedAt: 1,
    ...(grade === undefined ? {} : { grade }),
  },
});

const KEY = { correct: ["first"], kind: "choice" } as const;

describe("verdictOfQuestion", () => {
  it("reads a question without an answer as unanswered", () => {
    expect(verdictOfQuestion(makeTryoutQuestion("a"))).toBe("unanswered");
    expect(verdictOfQuestion(makeTryoutQuestion("a", answered([])))).toBe(
      "unanswered"
    );
  });

  it("reads a graded answer by its grade", () => {
    expect(
      verdictOfQuestion(
        makeTryoutQuestion(
          "a",
          answered(["first"], { category: 1, ceiling: 1, status: "scored" })
        )
      )
    ).toBe("correct");
    expect(
      verdictOfQuestion(
        makeTryoutQuestion(
          "a",
          answered(["second"], { category: 0, ceiling: 1, status: "scored" })
        )
      )
    ).toBe("incorrect");
  });

  it("reads an answer whose grade the reader may not see as answered", () => {
    expect(
      verdictOfQuestion(makeTryoutQuestion("a", answered(["first"])))
    ).toBe("answered");
  });
});

describe("readsWhole", () => {
  it("reads a section whole only when every question carries its key", () => {
    const keyed = { ...makeTryoutBody("a"), key: KEY };
    expect(readsWhole([{ body: keyed }, { body: keyed }])).toBe(true);
    expect(readsWhole([{ body: keyed }, { body: makeTryoutBody("b") }])).toBe(
      false
    );
  });
});

describe("reviewCellsOf", () => {
  it("numbers each question with its verdict, every one open", () => {
    const questions = [
      makeTryoutQuestion("a"),
      makeTryoutQuestion(
        "b",
        answered(["first"], { category: 1, ceiling: 1, status: "scored" })
      ),
    ];
    expect(reviewCellsOf(questions)).toEqual([
      { key: questions[0]?.placementId, shown: true, verdict: "unanswered" },
      { key: questions[1]?.placementId, shown: true, verdict: "correct" },
    ]);
  });
});
