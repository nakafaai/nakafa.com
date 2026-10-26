import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import { hasUniqueIds } from "@nakafa/aksara-contracts/assessment/identity";
import {
  type Interaction,
  InteractionSchema,
} from "@nakafa/aksara-contracts/assessment/interaction";
import {
  type InteractionKey,
  InteractionKeySchema,
} from "@nakafa/aksara-contracts/assessment/key";
import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Effect, Match, Schema } from "effect";

/**
 * The templates a question may take (K23): a single-answer multiple choice
 * (`choice`), and a complex multiple choice (`choices`), whose student checks
 * every correct option. A new question starts as `choice`, and each later
 * template adds its member here.
 */
export const QuestionTemplate = Schema.Literals(["choice", "choices"]);
export type QuestionTemplate = typeof QuestionTemplate.Type;

/** The template every new question starts as, an imported one included: a single-answer choice (K23). */
export const NEW_QUESTION_TEMPLATE: QuestionTemplate = "choice";

/**
 * The options a new question starts with. The research notes of this lane recorded
 * three to five options by grade, and four is the middle of that range. The teacher
 * adds or removes options from there.
 */
const NEW_QUESTION_OPTIONS = 4;

/** The most points a question is worth, which a teacher may not exceed. */
export const QUESTION_POINTS_MAX = 100;

/** The points a new question is worth: one, the usual weight of a question. */
export const NEW_QUESTION_POINTS = 1;

/** The points of a question: a whole number from one to `QUESTION_POINTS_MAX`. */
export const QuestionPoints = Schema.Int.check(
  Schema.isBetween({ maximum: QUESTION_POINTS_MAX, minimum: 1 })
);

/**
 * One question as its row stores it. `answers` is the JSON text of the question's
 * interactions, and `key` is the JSON text of its answer key, or null while no
 * option is marked correct, because the contract refuses a key with no correct
 * option. `revision` counts the answer and key edits, so a stale edit is refused.
 * `points` is the weight of the question. `prompt`, `rubric`, and `explanation` are
 * documents of their own: the question's text, the teacher's scoring guide, and the
 * explanation a learner reads after the result. Each of them is written by the
 * collaborative editor, and each one is frozen with its exam.
 */
export const questionValidator = Schema.Struct({
  answers: Schema.String,
  examId: Id("exams"),
  explanation: Id("editorDocuments"),
  key: Schema.NullOr(Schema.String),
  points: QuestionPoints,
  prompt: Id("editorDocuments"),
  revision: Schema.Natural,
  rubric: Id("editorDocuments"),
  template: QuestionTemplate,
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/** The fewest options a choice holds: a choice of one option asks nothing. */
export const CHOICE_OPTIONS_MIN = 2;

/** The most options a choice holds, which the letters A to E name. */
export const CHOICE_OPTIONS_MAX = 5;

/**
 * The most options one choice of a template takes: one for a single-answer choice, and
 * every option it holds for a complex choice, whose student checks each correct one.
 */
export const choiceLimit = (template: QuestionTemplate, options: number) =>
  Match.value(template).pipe(
    Match.when("choice", () => 1),
    Match.when("choices", () => options),
    Match.exhaustive
  );

/**
 * Whether a template's question takes a rubric, the teacher's guide to scoring an answer by hand.
 * A choice is scored by its key, so neither choice template takes one; the layer shows a rubric
 * only for a template that takes one.
 */
export const takesRubric = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("choice", () => false),
    Match.when("choices", () => false),
    Match.exhaustive
  );

/**
 * Whether the interactions of a question are the ones its template takes: distinct
 * choices of two to five options, each taking at least one option and at most the
 * template's limit (`choiceLimit`). A question that holds any other interaction, or a
 * choice of other bounds or of another number of options, is refused.
 */
export const answersFit = (
  template: QuestionTemplate,
  answers: readonly Interaction[]
) =>
  hasUniqueIds(answers) &&
  Arr.every(
    answers,
    (answer) =>
      answer.kind === "choice" &&
      answer.minChoices === 1 &&
      answer.maxChoices === choiceLimit(template, answer.options.length) &&
      answer.options.length >= CHOICE_OPTIONS_MIN &&
      answer.options.length <= CHOICE_OPTIONS_MAX
  );

/** The interactions of a question as JSON text, decoded with the contract's interaction schema. */
const AnswersText = Schema.fromJsonString(
  Schema.NonEmptyArray(InteractionSchema)
);

/**
 * A stored question's interactions, decoded with the contract's interaction schema. A stored
 * text that the contract refuses is a defect, because only interactions it accepts are written.
 */
export const questionAnswers = Effect.fn("exams.question.answers")(function* (
  text: string
) {
  return yield* Schema.decodeEffect(AnswersText)(text).pipe(Effect.orDie);
});

/** The answer key of a question as JSON text, decoded with the contract's key schema. */
const KeyText = Schema.fromJsonString(
  Schema.NonEmptyArray(InteractionKeySchema)
);

/**
 * One question as the wire shows it: its ID, its template, its points, its prompt, rubric
 * and explanation documents, its interactions, its key (null until one option is marked),
 * and its revision. Only the teacher's editor reads this view; a learner's paper reads the
 * interactions alone, so the key, the rubric, and the explanation never reach it.
 */
export const QuestionView = Schema.Struct({
  answers: Schema.NonEmptyArray(InteractionSchema),
  explanation: Id("editorDocuments"),
  id: Id("examQuestions"),
  key: Schema.NullOr(Schema.NonEmptyArray(InteractionKeySchema)),
  points: QuestionPoints,
  prompt: Id("editorDocuments"),
  revision: Schema.Natural,
  rubric: Id("editorDocuments"),
  template: QuestionTemplate,
});
export type QuestionView = typeof QuestionView.Type;

/** The JSON text a question's interactions are stored as. The contract refuses an encoding it cannot write, so that is a defect. */
export const encodeAnswers = Effect.fn("exams.question.encodeAnswers")(
  function* (answers: Arr.NonEmptyReadonlyArray<Interaction>) {
    return yield* Schema.encodeEffect(AnswersText)(answers).pipe(Effect.orDie);
  }
);

/** The JSON text an answer key is stored as. */
export const encodeKey = Effect.fn("exams.question.encodeKey")(function* (
  key: Arr.NonEmptyReadonlyArray<InteractionKey>
) {
  return yield* Schema.encodeEffect(KeyText)(key).pipe(Effect.orDie);
});

/**
 * Decodes a stored key into its typed form. A stored key that the contract refuses
 * is a defect, because only a key the contract accepted is ever written.
 */
const decodeKey = Effect.fn("exams.question.key")(function* (
  text: string | null
) {
  if (text === null) {
    return null;
  }
  return yield* Schema.decodeEffect(KeyText)(text).pipe(Effect.orDie);
});

/** A stored question as its wire view, with its answers and key decoded. */
export const questionView = Effect.fn("exams.question.view")(function* (
  row: ExamQuestionsDoc
) {
  const answers = yield* questionAnswers(row.answers);
  return {
    answers,
    explanation: row.explanation,
    id: row._id,
    key: yield* decodeKey(row.key),
    points: row.points,
    prompt: row.prompt,
    revision: row.revision,
    rubric: row.rubric,
    template: row.template,
  } satisfies QuestionView;
});

/**
 * The text of a new, empty document that a question owns as its prompt, rubric, or explanation: one
 * empty paragraph, which the contract accepts.
 */
export const EMPTY_PROMPT_TEXT =
  '{"content":[{"type":"paragraph"}],"type":"doc"}';

/** The label of an empty option: one empty paragraph of the content the contract allows in an option. */
const emptyLabel: typeof ContentDocumentSchema.Type = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

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

/**
 * The interactions of a new question: a single-answer choice with `NEW_QUESTION_OPTIONS`
 * empty options and no correct option marked.
 */
export const newChoiceAnswers = (): Arr.NonEmptyReadonlyArray<Interaction> =>
  choiceAnswers(Arr.makeBy(NEW_QUESTION_OPTIONS, () => emptyLabel));
