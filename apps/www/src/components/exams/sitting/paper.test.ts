import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import {
  nextVersionOf,
  type PaperQuestion,
  type PaperValue,
  setPaperFlag,
  setPaperResponse,
} from "@/components/exams/sitting/paper";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));

/** One question of a paper, with a text entry, the response it holds, and its version and flag. */
function question(
  id: string,
  response: readonly string[] | null,
  version: number | null = null
): PaperQuestion {
  return {
    flagged: false,
    id: questionId(id),
    interactions: [{ id: `${id}-entry`, kind: "textEntry", label: "Answer" }],
    number: 1,
    response,
    version,
  };
}

const paper: PaperValue = {
  questions: [question("question-a", null), question("question-b", ["b-1"], 4)],
};

describe("setPaperResponse", () => {
  it("replaces the response and the version of the question it names", () => {
    const changed = setPaperResponse(
      paper,
      questionId("question-a"),
      ["a-1"],
      1
    );

    expect(changed.questions).toMatchObject([
      { id: questionId("question-a"), response: ["a-1"], version: 1 },
      { id: questionId("question-b"), response: ["b-1"], version: 4 },
    ]);
  });
});

describe("setPaperFlag", () => {
  it("flags or unflags the question it names and leaves the others alone", () => {
    const flagged = setPaperFlag(paper, questionId("question-b"), true);
    const cleared = setPaperFlag(flagged, questionId("question-b"), false);

    expect(Arr.map(flagged.questions, (item) => item.flagged)).toEqual([
      false,
      true,
    ]);
    expect(Arr.map(cleared.questions, (item) => item.flagged)).toEqual([
      false,
      false,
    ]);
  });
});

describe("nextVersionOf", () => {
  it("numbers the first answer 1 and each later one above the saved version", () => {
    expect(nextVersionOf(question("question-a", null))).toBe(1);
    expect(nextVersionOf(question("question-b", ["b-1"], 4))).toBe(5);
  });
});
