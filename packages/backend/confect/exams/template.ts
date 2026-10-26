import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { keyFits } from "@repo/backend/confect/exams/key";
import {
  choiceLimit,
  fixedOptions,
  type QuestionTemplate,
  textLabel,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Option } from "effect";

/**
 * A question's interactions and key as another template takes them. A template that fixes its
 * options (`fixedOptions`) gives each choice those options, labelled with `labels` in order and
 * numbered from one, and clears the key, because no option the teacher marked is one of them. Any
 * other template keeps each choice's options and gives it the template's bounds (`choiceLimit`),
 * and the key stays when it fits the new interactions and is cleared otherwise, so a complex
 * choice that marks several options correct becomes a single-answer choice with no key, which the
 * teacher marks again.
 */
export const asTemplate = (
  template: QuestionTemplate,
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  key: Arr.NonEmptyReadonlyArray<InteractionKey> | null,
  labels: readonly string[]
) => {
  const fixed = Option.isSome(fixedOptions(template));
  const converted = Arr.map(answers, (answer): Interaction => {
    if (answer.kind !== "choice") {
      return answer;
    }
    const options = fixed
      ? Arr.map(labels, (text, index) => ({
          id: `option-${index + 1}`,
          label: textLabel(text),
        }))
      : answer.options;
    return {
      ...answer,
      maxChoices: choiceLimit(template, options.length),
      minChoices: 1,
      options,
    };
  });
  return {
    answers: converted,
    key: !fixed && key !== null && keyFits(converted, key) ? key : null,
  };
};
