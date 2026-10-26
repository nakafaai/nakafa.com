import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { AnswerRow } from "@repo/backend/confect/exams/results/contract";
import { gradedPage } from "@/components/exams/results/graded";
import { Schema } from "effect";

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
});
