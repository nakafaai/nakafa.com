import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Array as Arr } from "effect";

/**
 * The options a new question starts with. The research notes of this lane recorded
 * three to five options by grade, and four is the middle of that range. The teacher
 * adds or removes options from there.
 */
const NEW_QUESTION_OPTIONS = 4;

/** The label of an empty option: one empty paragraph of the content the contract allows in an option. */
export const emptyLabel: typeof ContentDocumentSchema.Type = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

/** The label of an option that reads `text`: one paragraph of plain text, as the option editor writes it. */
export const textLabel = (text: string): typeof ContentDocumentSchema.Type => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/**
 * The name of a new choice, read by screen readers. The contract refuses an empty label,
 * and the editor of this slice has no field for a teacher to name a choice yet, so a new
 * choice takes this placeholder. The answers mutation accepts any label the contract
 * accepts.
 */
const NEW_CHOICE_LABEL = "Answer";

/** A single-answer choice, the one interaction a question of this kind holds. */
type ChoiceInteraction = Extract<Interaction, { kind: "choice" }>;

/**
 * The interactions of a question with these option labels: one single-answer choice whose
 * options are numbered from one in order. `maxChoices` and `minChoices` are 1, and the
 * shuffle is off.
 */
export const choiceAnswers = (
  labels: Arr.NonEmptyReadonlyArray<typeof ContentDocumentSchema.Type>
): readonly [ChoiceInteraction] => [
  {
    id: "choice",
    kind: "choice",
    label: NEW_CHOICE_LABEL,
    maxChoices: 1,
    minChoices: 1,
    options: Arr.map(labels, (label, index) => ({
      id: `option-${index + 1}`,
      label,
    })),
    shuffle: false,
  },
];

/** The interactions of a short answer question: one text entry, which the key's accepted answers score. */
export const shortAnswers = (): readonly [
  Extract<Interaction, { kind: "textEntry" }>,
] => [{ id: "entry", kind: "textEntry", label: NEW_CHOICE_LABEL }];

/**
 * The interactions of a numeric answer: one numeric entry, which the key's value scores. It takes no
 * fraction and shows no unit until the teacher gives it one.
 */
export const numericAnswers = (): readonly [
  Extract<Interaction, { kind: "numericEntry" }>,
] => [
  {
    acceptsFractions: false,
    id: "number",
    kind: "numericEntry",
    label: NEW_CHOICE_LABEL,
  },
];

/** The statements and the answers a new matching question starts with. */
const NEW_MATCH_PARTS = 3;

/**
 * The interactions of a matching question: one match of `NEW_MATCH_PARTS` empty statements and as
 * many empty answers, numbered from one, each paired at most once.
 */
export const matchAnswers = (): readonly [
  Extract<Interaction, { kind: "match" }>,
] => [
  {
    id: "match",
    kind: "match",
    label: NEW_CHOICE_LABEL,
    shuffle: false,
    sources: [
      { id: "source-1", label: emptyLabel, maxMatches: 1 },
      ...Arr.makeBy(NEW_MATCH_PARTS - 1, (index) => ({
        id: `source-${index + 2}`,
        label: emptyLabel,
        maxMatches: 1,
      })),
    ],
    targets: [
      { id: "target-1", label: emptyLabel, maxMatches: 1 },
      ...Arr.makeBy(NEW_MATCH_PARTS - 1, (index) => ({
        id: `target-${index + 2}`,
        label: emptyLabel,
        maxMatches: 1,
      })),
    ],
  },
];

/**
 * The interactions of a true or false table: one table of `NEW_MATCH_PARTS` empty statements, and its two
 * columns labelled with `labels`, true then false, in the teacher's language.
 */
export const tableAnswers = (
  labels: readonly string[]
): readonly [Extract<Interaction, { kind: "matrix" }>] => [
  {
    columns: Arr.map(labels, (text, index) => ({
      id: `column-${index + 1}`,
      label: textLabel(text),
    })),
    id: "matrix",
    kind: "matrix",
    label: NEW_CHOICE_LABEL,
    shuffle: false,
    statements: [
      { id: "statement-1", label: emptyLabel },
      ...Arr.makeBy(NEW_MATCH_PARTS - 1, (index) => ({
        id: `statement-${index + 2}`,
        label: emptyLabel,
      })),
    ],
  },
];

/** The interactions of an essay question: one long text, which the teacher scores by the rubric. */
export const essayAnswers = (): readonly [
  Extract<Interaction, { kind: "extendedText" }>,
] => [{ id: "essay", kind: "extendedText", label: NEW_CHOICE_LABEL }];

/**
 * The interactions of a new question: a single-answer choice with `NEW_QUESTION_OPTIONS`
 * empty options and no correct option marked.
 */
export const newChoiceAnswers = (): Arr.NonEmptyReadonlyArray<Interaction> =>
  choiceAnswers(Arr.makeBy(NEW_QUESTION_OPTIONS, () => emptyLabel));
