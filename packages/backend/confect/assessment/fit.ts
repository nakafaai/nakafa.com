import { hasDistinctIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { cellsFit, pairsFit } from "@repo/backend/confect/assessment/key";
import {
  type ExamResponse,
  isCellsResponse,
  isChoiceResponse,
  isPairsResponse,
  isTextResponse,
  TEXT_RESPONSE_MAX,
} from "@repo/backend/confect/assessment/response";
import { Array as Arr, Match, Number as Num } from "effect";

/** A choice, whose response is the options the student chose. */
type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/**
 * Whether a response fits the choice: each option is one of its options, no option repeats,
 * and the count is within its minimum and maximum (ADR 0013).
 */
const fitsChoice = (choice: Choice, response: readonly string[]) =>
  hasDistinctIds(response) &&
  response.length >= choice.minChoices &&
  response.length <= choice.maxChoices &&
  Arr.every(response, (id) =>
    Arr.some(choice.options, (option) => option.id === id)
  );

/**
 * Whether a response fits the choices of a question of several, which one response answers together: every option
 * is an option of one choice, no option repeats, and no choice holds more than its maximum. A student answers them
 * one at a time, so a choice may still be open.
 */
const fitsChoices = (
  interactions: readonly Interaction[],
  response: ExamResponse
) => {
  const choices = Arr.filter(
    interactions,
    (interaction): interaction is Choice => interaction.kind === "choice"
  );
  if (choices.length !== interactions.length || !isChoiceResponse(response)) {
    return false;
  }
  const held = Arr.map(choices, (choice) => ({
    chosen: Arr.filter(response, (id) =>
      Arr.some(choice.options, (option) => option.id === id)
    ).length,
    most: choice.maxChoices,
  }));
  return (
    hasDistinctIds(response) &&
    Arr.every(held, ({ chosen, most }) => chosen <= most) &&
    Num.sumAll(Arr.map(held, ({ chosen }) => chosen)) === response.length
  );
};

/**
 * Whether a response fits the one interaction of a question: a choice takes the options it holds
 * (`fitsChoice`), a text entry and a numeric entry take one line of typed text, an essay takes written text, blank text
 * included in both, which leaves the question unanswered, and a match takes pairs that pair each of its
 * statements and answers at most once (`pairsFit`), none or some of them included, and a table takes cells
 * that mark each statement at most once (`cellsFit`). A question of several interactions takes a response
 * only when they are all choices (`fitsChoices`), and a question of any other shape takes none.
 */
export const fitsQuestion = (
  interactions: readonly Interaction[],
  response: ExamResponse
) => {
  if (interactions.length !== 1) {
    return fitsChoices(interactions, response);
  }
  return Arr.some(interactions, (interaction) =>
    Match.value(interaction).pipe(
      Match.when(
        { kind: "choice" },
        (choice) => isChoiceResponse(response) && fitsChoice(choice, response)
      ),
      Match.when(
        { kind: "textEntry" },
        () =>
          isTextResponse(response) && response.text.length <= TEXT_RESPONSE_MAX
      ),
      Match.when(
        { kind: "numericEntry" },
        () =>
          isTextResponse(response) && response.text.length <= TEXT_RESPONSE_MAX
      ),
      Match.when({ kind: "extendedText" }, () => isTextResponse(response)),
      Match.when(
        { kind: "match" },
        (match) => isPairsResponse(response) && pairsFit(match, response.pairs)
      ),
      Match.when(
        { kind: "matrix" },
        (matrix) =>
          isCellsResponse(response) && cellsFit(matrix, response.cells)
      ),
      Match.orElse(() => false)
    )
  );
};
