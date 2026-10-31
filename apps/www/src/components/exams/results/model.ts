import {
  type ExamPair,
  type ExamResponse,
  isCellsResponse,
  isPairsResponse,
  isTextResponse,
} from "@repo/backend/confect/assessment/response";
import { optionLetter, optionPlace } from "@repo/backend/confect/exams/letters";
import type { QuestionSummary } from "@repo/backend/confect/exams/results/contract";
import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import { Array as Arr, Option, Result, String as Str } from "effect";

/** The copy key that names each verdict of an answer. */
export const verdictKeys = {
  correct: "verdict-correct",
  incorrect: "verdict-incorrect",
  partial: "verdict-partial",
  pending: "verdict-pending",
} satisfies Record<
  Verdict,
  | "verdict-correct"
  | "verdict-incorrect"
  | "verdict-partial"
  | "verdict-pending"
>;

/**
 * The letters of the chosen options, in the order of the choice rather than the order of the answer, in the
 * script that names the question's options.
 */
const responseLetters = (
  question: QuestionParts,
  response: readonly string[]
) =>
  Arr.flatMap(question.optionIds, (optionId, index) =>
    Arr.contains(response, optionId)
      ? [
          optionLetter(
            optionPlace(question.optionIds, index),
            question.optionScript
          ),
        ]
      : []
  );

/**
 * The pairs of a match as a paper writes them, in the order of its statements: each statement's number
 * and the letter of the answer it took, such as `1-B`.
 */
const pairLabels = (question: QuestionParts, pairs: readonly ExamPair[]) =>
  Arr.filterMap(question.sourceIds, (sourceId, index) =>
    Option.match(
      Option.flatMap(
        Arr.findFirst(pairs, (pair) => pair.source === sourceId),
        (pair) =>
          Arr.findFirstIndex(question.targetIds, (id) => id === pair.target)
      ),
      {
        onNone: () => Result.failVoid,
        onSome: (target) =>
          Result.succeed(
            `${index + 1}-${optionLetter(target, question.targetScript)}`
          ),
      }
    )
  );

/** The parts of a question that a result names a response by: its options, statements, and answers in order. */
type QuestionParts = Pick<
  typeof QuestionSummary.Type,
  "optionIds" | "optionScript" | "sourceIds" | "targetIds" | "targetScript"
>;

/**
 * A saved response as a result shows it: the letters of the chosen options in the order of the choice,
 * the text the student typed without its surrounding spaces, or the pairs of a match or the cells of a
 * table (`pairLabels`). A response that answers nothing shows as empty text.
 */
export const responseText = (
  question: QuestionParts,
  response: ExamResponse
) => {
  if (isTextResponse(response)) {
    return Str.trim(response.text);
  }
  if (isPairsResponse(response)) {
    return Arr.join(pairLabels(question, response.pairs), ", ");
  }
  if (isCellsResponse(response)) {
    return Arr.join(
      pairLabels(
        question,
        Arr.map(response.cells, (cell) => ({
          source: cell.statement,
          target: cell.column,
        }))
      ),
      ", "
    );
  }
  return Arr.join(responseLetters(question, response), ", ");
};

/**
 * The share of the answered questions that are correct, as a whole percentage. A question with no
 * answer yet has no share, so the result is `null` rather than a percentage of nothing.
 */
export const correctShare = (stats: {
  readonly answered: number;
  readonly correct: number;
}) =>
  stats.answered === 0
    ? null
    : Math.round((stats.correct / stats.answered) * 100);
