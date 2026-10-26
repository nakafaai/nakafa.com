import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { keyFits } from "@repo/backend/confect/exams/key";
import {
  choiceLimit,
  type QuestionTemplate,
} from "@repo/backend/confect/exams/question";
import { Array as Arr } from "effect";

/**
 * A question's interactions and key as another template takes them. Each choice keeps its
 * options and takes the template's bounds (`choiceLimit`). The key stays when it fits the
 * new interactions and is cleared otherwise, so a complex choice that marks several options
 * correct becomes a single-answer choice with no key, which the teacher marks again.
 */
export const asTemplate = (
  template: QuestionTemplate,
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  key: Arr.NonEmptyReadonlyArray<InteractionKey> | null
) => {
  const converted = Arr.map(
    answers,
    (answer): Interaction =>
      answer.kind === "choice"
        ? {
            ...answer,
            maxChoices: choiceLimit(template, answer.options.length),
            minChoices: 1,
          }
        : answer
  );
  return {
    answers: converted,
    key: key !== null && keyFits(converted, key) ? key : null,
  };
};
