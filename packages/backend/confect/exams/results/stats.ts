import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type {
  examResultValidator,
  Verdict,
} from "@repo/backend/confect/exams/results/schema";
import {
  chosenOptions,
  isAnswered,
} from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr } from "effect";

/** The option IDs of a question's choices, in the order the choices list them. */
export const optionIdsOf = (interactions: readonly Interaction[]): string[] =>
  Arr.flatMap(interactions, (interaction) =>
    interaction.kind === "choice"
      ? Arr.map(interaction.options, (option) => option.id)
      : []
  );

/** One scored answer as a tally reads it: the options it chose or the text it typed, and its verdict. */
export type ScoredAnswer = Pick<
  typeof examResultValidator.Type,
  "response" | "verdict"
>;

/** How many of the answers hold one verdict. */
const countVerdict = (answers: readonly ScoredAnswer[], verdict: Verdict) =>
  Arr.filter(answers, (answer) => answer.verdict === verdict).length;

/**
 * The statistics of one question's answers: how many were answered, how many earned each verdict, and
 * how many answers chose each option, in the order of `optionIds`. An answer that chose several options
 * counts once for each of them. An unanswered question is not `answered`, whatever its verdict.
 */
export const tallyAnswers = (
  answers: readonly ScoredAnswer[],
  optionIds: readonly string[]
) => ({
  answered: Arr.filter(answers, (answer) => isAnswered(answer.response))
    .length,
  correct: countVerdict(answers, "correct"),
  incorrect: countVerdict(answers, "incorrect"),
  partial: countVerdict(answers, "partial"),
  optionCounts: Arr.map(optionIds, (optionId) => ({
    count: Arr.filter(answers, (answer) =>
      Arr.contains(chosenOptions(answer.response), optionId)
    ).length,
    optionId,
  })),
  pending: countVerdict(answers, "pending"),
});
