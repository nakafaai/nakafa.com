import {
  hasDistinctIds,
  hasUniqueIds,
} from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
  choiceLimit,
  fixedOptions,
  type QuestionTemplate,
  TABLE_COLUMNS,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Match, Option } from "effect";

/**
 * Whether one interaction is a choice that a choice template takes: a choice of two to five
 * options, as many as the template fixes when it fixes them (`fixedOptions`), taking at least one
 * option and at most the template's limit (`choiceLimit`).
 */
const choiceFits = (template: QuestionTemplate, answer: Interaction) =>
  answer.kind === "choice" &&
  answer.minChoices === 1 &&
  answer.maxChoices === choiceLimit(template, answer.options.length) &&
  answer.options.length >= CHOICE_OPTIONS_MIN &&
  answer.options.length <= CHOICE_OPTIONS_MAX &&
  Option.match(fixedOptions(template), {
    onNone: () => true,
    onSome: (count) => answer.options.length === count,
  });

/**
 * Whether one interaction is a match that the matching template takes: two to five statements and two
 * to five answers, each statement paired with one answer and each answer with one statement at most.
 */
const matchFits = (answer: Interaction) =>
  answer.kind === "match" &&
  answer.sources.length >= CHOICE_OPTIONS_MIN &&
  answer.sources.length <= CHOICE_OPTIONS_MAX &&
  answer.targets.length >= CHOICE_OPTIONS_MIN &&
  answer.targets.length <= CHOICE_OPTIONS_MAX &&
  Arr.every(
    [...answer.sources, ...answer.targets],
    (part) => part.maxMatches === 1
  );

/**
 * Whether one interaction is a table that the true or false template takes: two to five statements, and
 * the two columns, true and false.
 */
const tableFits = (answer: Interaction) =>
  answer.kind === "matrix" &&
  answer.statements.length >= CHOICE_OPTIONS_MIN &&
  answer.statements.length <= CHOICE_OPTIONS_MAX &&
  answer.columns.length === TABLE_COLUMNS;

/**
 * Whether the interactions of a question are the ones its template takes: distinct interactions and
 * distinct options, one interaction, or an answer and its reason for a two-tier question,
 * each a text entry for a short answer, a numeric entry for a numeric answer, a long text for an essay, a match for matching (`matchFits`), a
 * table for a true or false table (`tableFits`),
 * and each a choice that fits the template (`choiceFits`) for
 * every other template. A question that holds any other interaction is refused.
 */
export const answersFit = (
  template: QuestionTemplate,
  answers: readonly Interaction[]
) =>
  hasUniqueIds(answers) &&
  hasDistinctIds(
    Arr.flatMap(answers, (answer) =>
      answer.kind === "choice"
        ? Arr.map(answer.options, (option) => option.id)
        : []
    )
  ) &&
  answers.length === (template === "reason" ? 2 : 1) &&
  Arr.every(answers, (answer) =>
    Match.value(template).pipe(
      Match.when("short", () => answer.kind === "textEntry"),
      Match.when("numeric", () => answer.kind === "numericEntry"),
      Match.when("essay", () => answer.kind === "extendedText"),
      Match.when("match", () => matchFits(answer)),
      Match.when("table", () => tableFits(answer)),
      Match.orElse(() => choiceFits(template, answer))
    )
  );
