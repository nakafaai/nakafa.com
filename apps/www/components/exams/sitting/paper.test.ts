import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import {
  type PaperQuestion,
  type PaperValue,
  setPaperResponse,
} from "@/components/exams/sitting/paper";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));

/** One question of a paper, with a text entry and the response it holds. */
function question(
  id: string,
  response: readonly string[] | null
): PaperQuestion {
  return {
    id: questionId(id),
    interactions: [{ id: `${id}-entry`, kind: "textEntry", label: "Answer" }],
    number: 1,
    response,
  };
}

const paper: PaperValue = {
  questions: [question("question-a", null), question("question-b", ["b-1"])],
};

describe("setPaperResponse", () => {
  it("replaces the response of the question it names", () => {
    const next = setPaperResponse(paper, questionId("question-a"), ["a-2"]);

    expect(next.questions[0]?.response).toEqual(["a-2"]);
  });

  it("keeps every other question as the same object", () => {
    const next = setPaperResponse(paper, questionId("question-a"), ["a-2"]);

    expect(next.questions[1]).toBe(paper.questions[1]);
  });

  it("leaves the paper as it was when no question has the id", () => {
    const next = setPaperResponse(paper, questionId("question-z"), ["z-1"]);

    expect(next).toEqual(paper);
    expect(Arr.length(next.questions)).toBe(2);
  });
});
