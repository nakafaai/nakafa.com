import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { AnswerRow } from "@repo/backend/confect/exams/results/contract";
import { Option, Schema } from "effect";
import {
  gradedAttempt,
  gradedPage,
  typedPoints,
} from "@/components/exams/results/graded";

const attemptId = Schema.decodeUnknownSync(Id("examAttempts"));

/** One student's pending essay answer, as the question's list shows it. */
const answerOf = (id: string): typeof AnswerRow.Type => ({
  attemptId: attemptId(id),
  name: `Siswa ${id}`,
  points: 0,
  response: { text: "Jawaban" },
  verdict: "pending",
});

describe("components/exams/results graded", () => {
  it("gives the graded answer its points and the verdict they earn, and leaves the others", () => {
    const page = [answerOf("a"), answerOf("b")];
    expect(
      gradedPage(page, { attemptId: attemptId("a"), points: 2, weight: 4 })
    ).toEqual([{ ...page[0], points: 2, verdict: "partial" }, page[1]]);
    expect(
      gradedPage(page, { attemptId: attemptId("b"), points: 4, weight: 4 })
    ).toEqual([page[0], { ...page[1], points: 4, verdict: "correct" }]);
    expect(
      gradedPage(page, { attemptId: attemptId("a"), points: 0, weight: 4 })
    ).toEqual([{ ...page[0], points: 0, verdict: "incorrect" }, page[1]]);
  });

  it("gives a student's graded question its points and verdict, and adds up the attempt again", () => {
    const questionId = Schema.decodeUnknownSync(Id("examQuestions"));
    const result = {
      name: "Siswa",
      points: 1,
      questions: [
        {
          earned: 1,
          id: questionId("q1"),
          number: 1,
          optionIds: [],
          optionScript: "latin" as const,
          points: 1,
          response: ["option-1"],
          sourceIds: [],
          targetIds: [],
          targetScript: "latin" as const,
          verdict: "correct" as const,
        },
        {
          earned: 0,
          id: questionId("q2"),
          number: 2,
          optionIds: [],
          optionScript: "latin" as const,
          points: 4,
          response: { text: "Esai" },
          sourceIds: [],
          targetIds: [],
          targetScript: "latin" as const,
          verdict: "pending" as const,
        },
      ],
    };
    expect(
      gradedAttempt(result, { points: 3, questionId: questionId("q2") })
    ).toEqual({
      ...result,
      points: 4,
      questions: [
        result.questions[0],
        { ...result.questions[1], earned: 3, verdict: "partial" },
      ],
    });
  });
});

describe("typedPoints", () => {
  it("takes a whole number from none to the question's points", () => {
    expect(typedPoints("0", 4)).toEqual(Option.some(0));
    expect(typedPoints(" 4 ", 4)).toEqual(Option.some(4));
  });

  it("takes nothing else, so the field keeps it for the teacher to correct", () => {
    expect(typedPoints("5", 4)).toEqual(Option.none());
    expect(typedPoints("-1", 4)).toEqual(Option.none());
    expect(typedPoints("1.5", 4)).toEqual(Option.none());
    expect(typedPoints("x", 4)).toEqual(Option.none());
    expect(typedPoints("  ", 4)).toEqual(Option.none());
  });
});
