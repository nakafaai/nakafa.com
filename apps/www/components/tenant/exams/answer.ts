import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr, Option, String as Str } from "effect";

/** The choice interaction, the only kind a school exam question holds in this version. */
type Choice = Extract<Interaction, { kind: "choice" }>;

/** The label of one option: a document of its own, which this editor writes as one paragraph of text. */
type OptionLabel = Choice["options"][number]["label"];

/** The character code of the letter A, which names the first option. */
const LETTER_A = 65;

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
