import { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, pipe, Schema, String as Str } from "effect";

/** The choice interaction, which a single-answer and a complex multiple choice both hold. */
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

/**
 * What a change of an option's text asks for: the label the teacher typed, which is saved, or a text
 * the contract refuses, which is reported.
 */
const OptionEditSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("refused") }),
  Schema.Struct({
    kind: Schema.Literal("typed"),
    label: ContentDocumentSchema,
  }),
]);

/** What a change of an option's text asks for, as `OptionEditSchema` describes it. */
export type OptionEdit = typeof OptionEditSchema.Type;

/**
 * The edit that one change of an option's editor makes, or none when the change edits no text. Tiptap
 * emits an update when the editor's lock is set, and that update edits nothing, so it neither saves
 * the label nor reports a failure. A change of the text is typed when the contract takes its label,
 * and refused when it does not.
 */
export const optionEditOf = (change: {
  readonly docChanged: boolean;
  readonly json: unknown;
}): Option.Option<OptionEdit> => {
  if (!change.docChanged) {
    return Option.none();
  }
  return Option.some(
    Option.match(optionLabelOf(change.json), {
      onNone: (): OptionEdit => ({ kind: "refused" }),
      onSome: (label): OptionEdit => ({ kind: "typed", label }),
    })
  );
};

const sameLabel = Schema.toEquivalence(ContentDocumentSchema);

/**
 * Whether an option's editor holds the label, read through the contract. A document the contract refuses is no
 * label, so an editor that holds one holds no label.
 */
export const holdsLabel = (json: unknown, label: OptionLabel): boolean =>
  Option.match(optionLabelOf(json), {
    onNone: () => false,
    onSome: (held) => sameLabel(held, label),
  });

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
 * The key that marks these options correct in each interaction, in the order given, or null when it
 * marks none, since the contract refuses a key with no correct option.
 */
const keyMarking = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  correct: readonly string[]
): Arr.NonEmptyArray<InteractionKey> | null =>
  Arr.isReadonlyArrayNonEmpty(correct)
    ? Arr.map(
        answers,
        (answer): InteractionKey => ({
          correct,
          interaction: answer.id,
          kind: "choice",
        })
      )
    : null;

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

/** The options that a key marks correct, or none while the key is absent or marks no choice. */
export const markedOptions = (
  key: readonly InteractionKey[] | null
): readonly string[] => {
  if (key === null) {
    return [];
  }
  return Option.match(Arr.findFirst(key, isChoiceKey), {
    onNone: () => [],
    onSome: (answer) => answer.correct,
  });
};

/**
 * The one option whose mark changed between two sets of marked options: the option that joined, or
 * else the option that left, or none when the sets mark the same options.
 */
export const changedOption = (
  before: readonly string[],
  after: readonly string[]
): Option.Option<string> =>
  Option.orElse(
    Arr.findFirst(after, (id) => !Arr.contains(before, id)),
    () => Arr.findFirst(before, (id) => !Arr.contains(after, id))
  );

/**
 * The key of a complex choice once one option is marked or unmarked: the option joins the correct
 * ones, or leaves them when it was one, and the correct options keep the order of the choice. A key
 * that marks no option any more is null.
 */
export const toggledKey = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  key: readonly InteractionKey[] | null,
  optionId: string
): Arr.NonEmptyArray<InteractionKey> | null => {
  const marked = markedOptions(key);
  const next = Arr.contains(marked, optionId)
    ? Arr.filter(marked, (id) => id !== optionId)
    : Arr.append(marked, optionId);
  const order = Option.match(choiceOf(answers), {
    onNone: () => next,
    onSome: (choice) =>
      Arr.filter(
        Arr.map(choice.options, (option) => option.id),
        (id) => Arr.contains(next, id)
      ),
  });
  return keyMarking(answers, order);
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
 * The most options a choice takes once it holds `count` options: a single-answer choice keeps one,
 * and a complex choice, which takes every option it holds, takes them all.
 */
const limitAfter = (choice: Choice, count: number) =>
  choice.maxChoices === 1 ? 1 : count;

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
          maxChoices: limitAfter(answer, answer.options.length + 1),
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
          maxChoices: limitAfter(answer, answer.options.length - 1),
          options: Arr.filter(
            answer.options,
            (option) => option.id !== optionId
          ),
        }
      : answer
  );

/**
 * The key once one option is taken out: the removed option leaves the correct ones, and the key is
 * cleared when no correct option is left, since no option of the question would then be correct.
 */
export const keyWithoutOption = (
  key: Arr.NonEmptyReadonlyArray<InteractionKey> | null,
  optionId: string
): Arr.NonEmptyReadonlyArray<InteractionKey> | null => {
  const remaining = Arr.filter(markedOptions(key), (id) => id !== optionId);
  if (key === null || !Arr.isReadonlyArrayNonEmpty(remaining)) {
    return null;
  }
  return Arr.map(key, (answer) =>
    isChoiceKey(answer) ? { ...answer, correct: remaining } : answer
  );
};

/** The text entry interaction, which a short answer holds. */
type TextEntry = Extract<Interaction, { kind: "textEntry" }>;

/** Whether an interaction is a text entry. */
const isTextEntry = (answer: Interaction): answer is TextEntry =>
  answer.kind === "textEntry";

/** The first text entry of a question's answers, or none when the answers hold no text entry. */
export const entryOf = (
  answers: readonly Interaction[]
): Option.Option<TextEntry> => Arr.findFirst(answers, isTextEntry);

/** The answers a key accepts for a short answer, in the order the teacher wrote them, or none without a key. */
export const acceptedOf = (
  key: readonly InteractionKey[] | null
): readonly string[] =>
  Option.match(
    Arr.findFirst(
      key ?? [],
      (answer): answer is Extract<InteractionKey, { kind: "textEntry" }> =>
        answer.kind === "textEntry"
    ),
    {
      onNone: () => [],
      onSome: (answer) => answer.accepted.acceptedAnswers,
    }
  );

/** A run of whitespace of any kind, which an accepted answer writes as one ordinary space. */
const WHITESPACE_RUN = /\s+/gu;

/** A control or invisible format character, which no accepted answer may hold. */
const UNTYPABLE = /[\p{Cc}\p{Cf}]/gu;

/**
 * The key that accepts these texts for each interaction of a short answer, as the contract takes them: each
 * text in Unicode NFC, without invisible characters, with each run of spaces as one space, and trimmed;
 * a blank text dropped; and a text that grades the same as an earlier one, whatever its case, dropped.
 * The key ignores case and extra spaces, as a teacher marks a short answer by hand. A key that accepts
 * no text is null, since the contract refuses a key with no accepted answer.
 */
export const acceptedKey = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  texts: readonly string[]
): Arr.NonEmptyArray<InteractionKey> | null => {
  const cleaned = Arr.dedupeWith(
    Arr.filter(
      Arr.map(texts, (text) =>
        pipe(
          text,
          Str.normalize("NFC"),
          Str.replaceAll(UNTYPABLE, ""),
          Str.replaceAll(WHITESPACE_RUN, " "),
          Str.trim
        )
      ),
      Str.isNonEmpty
    ),
    (first, second) => Str.toLowerCase(first) === Str.toLowerCase(second)
  );
  if (!Arr.isReadonlyArrayNonEmpty(cleaned)) {
    return null;
  }
  return Arr.map(
    answers,
    (answer): InteractionKey => ({
      accepted: {
        acceptedAnswers: cleaned,
        collapseWhitespace: true,
        ignoreCase: true,
        kind: "text",
      },
      interaction: answer.id,
      kind: "textEntry",
    })
  );
};

/**
 * The plain text of a label: the text of its paragraphs in order, joined by spaces, as a control that shows
 * a short label as text reads it, such as the columns of a true or false table in the key.
 */
export const labelText = (label: OptionLabel): string =>
  Arr.join(
    Arr.flatMap(label.content, (block) =>
      block.type === "paragraph"
        ? [
            Arr.join(
              Arr.flatMap(block.content ?? [], (node) =>
                node.type === "text" ? [node.text] : []
              ),
              ""
            ),
          ]
        : []
    ),
    " "
  );
