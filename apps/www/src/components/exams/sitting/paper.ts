import type { PaperView } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr } from "effect";

/** The paper of a student's open attempt, as the server reads it. */
export type PaperValue = typeof PaperView.Type;

/** One question of the paper, with its interactions and its saved response. */
export type PaperQuestion = PaperValue["questions"][number];

/**
 * The paper with the response of one question replaced. The screen shows a chosen option with
 * this change at once. The server's answer then replaces it, and a refused answer rolls it back.
 */
export function setPaperResponse(
  paper: PaperValue,
  questionId: PaperQuestion["id"],
  response: readonly string[]
): PaperValue {
  return {
    questions: Arr.map(paper.questions, (question) =>
      question.id === questionId ? { ...question, response } : question
    ),
  };
}
