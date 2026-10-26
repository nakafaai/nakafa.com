import { hasDistinctIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { cellsFit, pairsFit } from "@repo/backend/confect/exams/key";
import {
  type ExamResponse,
  isCellsResponse,
  isChoiceResponse,
  isPairsResponse,
  isTextResponse,
  TEXT_RESPONSE_MAX,
} from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr, Match } from "effect";

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
 * Whether a response fits the one interaction of a question: a choice takes the options it holds
 * (`fitsChoice`), a text entry takes one line of typed text, an essay takes written text, blank text
 * included in both, which leaves the question unanswered, and a match takes pairs that pair each of its
 * statements and answers at most once (`pairsFit`), none or some of them included, and a table takes cells
 * that mark each statement at most once (`cellsFit`). A question of any other shape, or of
 * more than one interaction, takes no response.
 */
export const fitsQuestion = (
  interactions: readonly Interaction[],
  response: ExamResponse
) => {
  if (interactions.length !== 1) {
    return false;
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
