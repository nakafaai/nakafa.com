import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  emptyLabel,
  newChoiceAnswers,
} from "@repo/backend/confect/exams/question";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import { Array as Arr } from "effect";

/** The name of a new reason, read by screen readers, as a new choice is named `Answer`. */
const NEW_REASON_LABEL = "Reason";

/** The reasons a new two-tier question starts with. */
const NEW_REASON_OPTIONS = 3;

/**
 * The second choice of a two-tier question: the reason a student gives for the answer, with no option marked. Its
 * options take their own prefix, so the one response of the paper tells the two choices' options apart.
 */
export const reasonChoice = (): Extract<Interaction, { kind: "choice" }> => ({
  id: REASON_ID,
  kind: "choice",
  label: NEW_REASON_LABEL,
  maxChoices: 1,
  minChoices: 1,
  options: Arr.makeBy(NEW_REASON_OPTIONS, (index) => ({
    id: `${REASON_ID}-${index + 1}`,
    label: emptyLabel,
  })),
  shuffle: false,
});

/** The interactions of a new two-tier question: an empty answer and an empty reason, with no option marked. */
export const reasonAnswers = (): Arr.NonEmptyReadonlyArray<Interaction> => [
  ...newChoiceAnswers(),
  reasonChoice(),
];
