import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  type PracticeQuestion,
  practiceCellsOf,
  practiceProgressOf,
} from "@/components/tryout/practice/model";

const questionId = Schema.decodeUnknownSync(Id("practiceQuestions"));

/** A question of a practice, checked with `category` points of 1 when given. */
const question = (name: string, category?: number): PracticeQuestion => ({
  answer:
    category === undefined
      ? null
      : {
          checkedAt: 1,
          grade: { category, ceiling: 1, status: "scored" },
          response: ["option-1"],
        },
  questionId: questionId(name),
  questionOrder: 1,
});

describe("practiceCellsOf", () => {
  it("shows a checked question's verdict and one not checked yet as unanswered", () => {
    expect(
      practiceCellsOf([question("a", 1), question("b", 0), question("c")])
    ).toEqual([
      { key: questionId("a"), shown: true, verdict: "correct" },
      { key: questionId("b"), shown: true, verdict: "incorrect" },
      { key: questionId("c"), shown: true, verdict: "unanswered" },
    ]);
  });
});

describe("practiceProgressOf", () => {
  it("counts the questions checked and those checked correct", () => {
    expect(
      practiceProgressOf([question("a", 1), question("b", 0), question("c")])
    ).toEqual({ checked: 2, correct: 1, total: 3 });
  });
});
