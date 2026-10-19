import { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, Schema } from "effect";

/** The choice interaction, the only kind a school exam question holds in this version. */
type Choice = Extract<Interaction, { kind: "choice" }>;

/** The label of one option: a rich document of its own, which the option's editor writes. */
export type OptionLabel = Choice["options"][number]["label"];

/** The character code of the letter A, which names the first option. */
const LETTER_A = 65;

/** The number that an option ID holds after `option-`, when it holds one. */
const OPTION_NUMBER = /^option-(\d+)$/u;

/** Whether an interaction is a choice. */
const isChoice = (answer: Interaction): answer is Choice =>
  answer.kind === "choice";

/** Whether a key answer is the answer of a choice. */
const isChoiceKey = (
  answer: InteractionKey
): answer is Extract<InteractionKey, { kind: "choice" }> =>
  answer.kind === "choice";

/** The letter that names an option by its place: A for the first option, B for the second, and so on. */
export const optionLetter = (index: number): string =>
  String.fromCharCode(LETTER_A + index);

/**
 * The label of an option as its editor holds it: the JSON of its document, read through the
 * contract. A document the contract refuses is no label, so nothing is saved for it.
 */
export const optionLabelOf = (json: unknown): Option.Option<OptionLabel> =>
  Schema.decodeUnknownOption(ContentDocumentSchema)(json);

/** The label of an empty option: one empty paragraph, which the contract allows in an option. */
export const emptyLabel = (): OptionLabel => ({
  content: [{ type: "paragraph" }],
  type: "doc",
});

/** The first choice of a question's answers, or none when the answers hold no choice. */
export const choiceOf = (
  answers: readonly Interaction[]
): Option.Option<Choice> => Arr.findFirst(answers, isChoice);

/**
 * The answers with the label of one option replaced by the document its editor holds. The other
 * options and the other interactions keep their order, IDs, and content.
 */
export const withOptionLabel = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  optionId: string,
  label: OptionLabel
): Arr.NonEmptyArray<Interaction> =>
  Arr.map(answers, (answer) =>
    isChoice(answer)
      ? {
          ...answer,
          options: Arr.map(answer.options, (option) =>
            option.id === optionId ? { ...option, label } : option
          ),
        }
      : answer
  );

/**
 * The key that marks one option correct in each interaction. A question holds one
 * choice, so the key holds one answer, and a single-answer choice takes one option.
 */
export const markedKey = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  optionId: string
): Arr.NonEmptyArray<InteractionKey> =>
  Arr.map(
    answers,
    (answer): InteractionKey => ({
      correct: [optionId],
      interaction: answer.id,
      kind: "choice",
    })
  );

/** The option that a key marks correct, or none while the key is absent or marks no choice. */
export const markedOption = (
  key: readonly InteractionKey[] | null
): string | null => {
  if (key === null) {
    return null;
  }
  return Option.match(Arr.findFirst(key, isChoiceKey), {
    onNone: () => null,
    onSome: (answer) => Arr.headNonEmpty(answer.correct),
  });
};

/**
 * The ID of a new option: `option-` and the number after the largest one that the choice
 * holds, so a new option never shares an ID with an option the choice still holds. An ID
 * that a removed option held can come back, which is safe, because options change only
 * while the exam is unfrozen, and no attempt holds an answer then.
 */
const nextOptionId = (options: readonly Choice["options"][number][]) => {
  const largest = Arr.reduce(options, 0, (most, option) => {
    const digits = OPTION_NUMBER.exec(option.id)?.[1];
    return digits === undefined ? most : Math.max(most, Number(digits));
  });
  return `option-${largest + 1}`;
};

/**
 * The answers with one empty option added at the end of each choice. A choice that holds
 * the most options it may take is left as it is, so the teacher cannot add past A to E.
 */
export const withOptionAdded = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>
): Arr.NonEmptyArray<Interaction> =>
  Arr.map(answers, (answer) =>
    isChoice(answer) && answer.options.length < CHOICE_OPTIONS_MAX
      ? {
          ...answer,
          options: [
            ...answer.options,
            { id: nextOptionId(answer.options), label: emptyLabel() },
          ],
        }
      : answer
  );

/**
 * The answers with one option taken out of each choice. A choice that holds the fewest options
 * it may take is left as it is. The key that follows the removal is `keyWithoutOption`.
 */
export const withOptionRemoved = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  optionId: string
): Arr.NonEmptyArray<Interaction> =>
  Arr.map(answers, (answer) =>

    isChoice(answer) && answer.options.length > CHOICE_OPTIONS_MIN
      ? {
          ...answer,
          options: Arr.filter(
            answer.options,
            (option) => option.id !== optionId
          ),
        }
      : answer
  );

/**
 * The key once one option is taken out: a key that marks another option stays as it is, and it is
 * cleared when it marked the removed option, since no option of the question would then be correct.
 */
export const keyWithoutOption = (
  key: Arr.NonEmptyReadonlyArray<InteractionKey> | null,
  optionId: string
): Arr.NonEmptyReadonlyArray<InteractionKey> | null =>
  markedOption(key) === optionId ? null : key;
