import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type {
  examResultValidator,
  Verdict,
} from "@repo/backend/confect/exams/results/schema";
import {
  chosenOptions,
  isAnswered,
} from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr, Match } from "effect";

/** The option IDs of a question's choices, in the order the choices list them. */
export const optionIdsOf = (interactions: readonly Interaction[]): string[] =>
  Arr.flatMap(interactions, (interaction) =>
    interaction.kind === "choice"
      ? Arr.map(interaction.options, (option) => option.id)
      : []
  );

/**
 * The statements of a question's matches and tables, and the answers of its matches or the columns of
 * its tables, each in the order the interaction lists them, and none for another interaction. A result
 * names a pair or a cell by the statement's number and the letter of its answer or column.
 */
export const pairIdsOf = (interactions: readonly Interaction[]) => ({
  sourceIds: Arr.flatMap(interactions, (interaction) =>
    Match.value(interaction).pipe(
      Match.when({ kind: "match" }, (match) =>
        Arr.map(match.sources, (part) => part.id)
      ),
      Match.when({ kind: "matrix" }, (matrix) =>
        Arr.map(matrix.statements, (part) => part.id)
      ),
      Match.orElse(() => [])
    )
  ),
  targetIds: Arr.flatMap(interactions, (interaction) =>
    Match.value(interaction).pipe(
      Match.when({ kind: "match" }, (match) =>
        Arr.map(match.targets, (part) => part.id)
      ),
      Match.when({ kind: "matrix" }, (matrix) =>
        Arr.map(matrix.columns, (part) => part.id)
      ),
      Match.orElse(() => [])
    )
  ),
});

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
