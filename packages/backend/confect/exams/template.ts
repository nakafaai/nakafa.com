import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { keyFits } from "@repo/backend/confect/assessment/key";
import {
  choiceLimit,
  essayAnswers,
  fixedOptions,
  matchAnswers,
  newChoiceAnswers,
  numericAnswers,
  type QuestionTemplate,
  type QuestionView,
  shortAnswers,
  tableAnswers,
  textLabel,
} from "@repo/backend/confect/exams/question";
import {
  reasonAnswers,
  reasonChoice,
} from "@repo/backend/confect/exams/reason";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import { Array as Arr, Option } from "effect";

/**
 * A question's interactions and key as another template takes them. A short answer takes one text
 * entry, a numeric answer one numeric entry and an essay one long text, each with no key, and a choice template turns either into a new
 * choice first. A template that fixes its
 * options (`fixedOptions`) gives each choice those options, labelled with `labels` in order and
 * numbered from one, and clears the key, because no option the teacher marked is one of them. Any
 * other template keeps each choice's options and gives it the template's bounds (`choiceLimit`),
 * and the key stays when it fits the new interactions and is cleared otherwise, so a complex
 * choice that marks several options correct becomes a single-answer choice with no key, which the
 * teacher marks again. A two-tier question keeps a choice as its answer and adds an empty reason, and
 * any choice template keeps its answer alone.
 */
export const asTemplate = (
  template: QuestionTemplate,
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  key: Arr.NonEmptyReadonlyArray<InteractionKey> | null,
  labels: readonly string[]
): Pick<QuestionView, "answers" | "key"> => {
  if (template === "short") {
    return { answers: shortAnswers(), key: null };
  }
  if (template === "numeric") {
    return { answers: numericAnswers(), key: null };
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
  // The first choice stays the answer, so its words stay, and its mark is the teacher's to give again.
  const answer = Arr.findFirst(answers, (part) => part.kind === "choice");
  if (template === "reason") {
    return {
      answers: Option.match(answer, {
        onNone: reasonAnswers,
        onSome: (choice) => [
          { ...choice, maxChoices: 1, minChoices: 1 },
          reasonChoice(),
        ],
      }),
      key: null,
    };
  }
  const fixed = Option.isSome(fixedOptions(template));
  // A short answer, a numeric answer, an essay, and a match hold no choice, so a choice template starts them from a new choice.
  const choices = Arr.match(
    Arr.filter(answers, (part) => part.id !== REASON_ID),
    {
      onEmpty: newChoiceAnswers,
      onNonEmpty: (parts) =>
        Option.isSome(answer) ? parts : newChoiceAnswers(),
    }
  );
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
  // A two-tier question leaves its reason, and the reason's mark with it.
  const kept =
    key === null
      ? null
      : Arr.filter(key, ({ interaction }) =>
          Arr.some(converted, (answer) => answer.id === interaction)
        );
  return {
    answers: converted,
    key: !fixed && kept !== null && keyFits(converted, kept) ? kept : null,
  };
};
