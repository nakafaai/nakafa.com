import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, String as Str } from "effect";

/** The choice interaction, the only kind a school exam question holds in this version. */
type Choice = Extract<Interaction, { kind: "choice" }>;

/** The label of one option: a document of its own, which this editor writes as one paragraph of text. */
type OptionLabel = Choice["options"][number]["label"];

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
 * The text of an option's label: the text of its paragraphs, in order. This editor
 * writes one paragraph of text, so math and every other node are left out.
 */
export const labelText = (label: OptionLabel): string =>
  Arr.join(
    Arr.flatMap(label.content, (block) =>
      block.type === "paragraph"
        ? Arr.flatMap(block.content ?? [], (node) =>
            node.type === "text" ? [node.text] : []
          )
        : []
    ),
    ""
  );

/** A label that holds `text` as one paragraph. An empty text is an empty paragraph, which the contract allows in an option. */
export const textLabel = (text: string): OptionLabel => ({
  content: [
    Str.isEmpty(text)
      ? { type: "paragraph" }
      : { content: [{ text, type: "text" }], type: "paragraph" },
  ],
  type: "doc",
});

/** The first choice of a question's answers, or none when the answers hold no choice. */
export const choiceOf = (
  answers: readonly Interaction[]
): Option.Option<Choice> => Arr.findFirst(answers, isChoice);

/**
 * The answers with the text of one option replaced. The other options and the other
 * interactions keep their order, IDs, and content.
 */
export const withOptionText = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  optionId: string,
  text: string
): Arr.NonEmptyArray<Interaction> =>
  Arr.map(answers, (answer) =>
    isChoice(answer)
      ? {
          ...answer,
          options: Arr.map(answer.options, (option) =>
            option.id === optionId
              ? { ...option, label: textLabel(text) }
              : option
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
            { id: nextOptionId(answer.options), label: textLabel("") },
          ],
        }
      : answer
  );

/**
 * The answers with one option taken out of each choice, and the key that follows them. The
 * key names its option by ID, so it keeps its option when the others go, and it is cleared when
 * the removed option is the one it marks, because no option of the question would then be correct.
 * A choice that holds the fewest options it may take is left as it is.
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
