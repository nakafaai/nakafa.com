import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { keyFits } from "@repo/backend/confect/exams/key";
import {
  choiceLimit,
  essayAnswers,
  fixedOptions,
  matchAnswers,
  newChoiceAnswers,
  type QuestionTemplate,
  shortAnswers,
  tableAnswers,
  textLabel,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Option } from "effect";

/**
 * A question's interactions and key as another template takes them. A short answer takes one text
 * entry and an essay one long text, both with no key, and a choice template turns either into a new
 * choice first. A template that fixes its
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
): {
  readonly answers: Arr.NonEmptyReadonlyArray<Interaction>;
  readonly key: Arr.NonEmptyReadonlyArray<InteractionKey> | null;
} => {
  if (template === "short") {
    return { answers: shortAnswers(), key: null };
  }
  if (template === "essay") {
    return { answers: essayAnswers(), key: null };
  }
  if (template === "match") {
    return { answers: matchAnswers(), key: null };
  }
  if (template === "table") {
    return { answers: tableAnswers(labels), key: null };
  }
  const fixed = Option.isSome(fixedOptions(template));
  // A short answer, an essay, and a match hold no choice, so a choice template starts them from a new choice.
  const choices = Arr.some(answers, (answer) => answer.kind === "choice")
    ? answers
    : newChoiceAnswers();
  const converted = Arr.map(choices, (answer): Interaction => {
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
