import type { PaperView } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr } from "effect";

/** The paper of a student's open attempt, as the server reads it. */
export type PaperValue = typeof PaperView.Type;

/** One question of the paper, with its interactions and its saved response. */
export type PaperQuestion = PaperValue["questions"][number];

/**
 * The paper with the response of one question replaced, numbered with `version`. The screen shows a chosen
 * option with this change at once. The server's answer then replaces it, and a refused answer rolls it back.
 */
export function setPaperResponse(
  paper: PaperValue,
  questionId: PaperQuestion["id"],
  response: readonly string[],
  version: number
): PaperValue {
  return {
    questions: Arr.map(paper.questions, (question) =>
      question.id === questionId ? { ...question, response, version } : question
    ),
  };
}

/** The paper with one question flagged or unflagged. The screen shows the flag at once, and a refused flag rolls it back. */
export function setPaperFlag(
  paper: PaperValue,
  questionId: PaperQuestion["id"],
  flagged: boolean
): PaperValue {
  return {
    questions: Arr.map(paper.questions, (question) =>
      question.id === questionId ? { ...question, flagged } : question
    ),
  };
}

/**
 * The version that the next answer of a question is numbered with: one above the saved version, and the first
 * version for a question that holds no saved answer (ADR 0013).
 */
export function nextVersionOf(question: PaperQuestion) {
  return (question.version ?? 0) + 1;
}
