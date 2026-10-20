import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import { Array as Arr } from "effect";

/** The copy key that names each verdict of an answer. */
export const verdictKeys = {
  correct: "verdict-correct",
  incorrect: "verdict-incorrect",
  pending: "verdict-pending",
} satisfies Record<
  Verdict,
  "verdict-correct" | "verdict-incorrect" | "verdict-pending"
>;

/** The character code of the capital letter A, which names the first option of a choice. */
const CODE_OF_A = 65;

/** The letter that names an option by its place in its choice: A for the first, B for the second, and so on. */
export const optionLetter = (index: number) =>
  String.fromCharCode(CODE_OF_A + index);

/** The letters of the chosen options, in the order of the choice rather than the order of the answer. */
export const responseLetters = (
  optionIds: readonly string[],
  response: readonly string[]
) =>
  Arr.flatMap(optionIds, (optionId, index) =>
    Arr.contains(response, optionId) ? [optionLetter(index)] : []
  );

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
