import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import {
  type Interaction,
  InteractionSchema,
} from "@nakafa/aksara-contracts/assessment/interaction";
import {
  type InteractionKey,
  InteractionKeySchema,
} from "@nakafa/aksara-contracts/assessment/key";
import { DefaultRuleSchema } from "@nakafa/aksara-contracts/assessment/scoring";
import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { keyFits } from "@repo/backend/confect/assessment/key";
import { QuestionMedia } from "@repo/backend/confect/exams/media";
import {
  ALL_OR_NOTHING,
  takesScoring,
} from "@repo/backend/confect/exams/scoring";
import { Array as Arr, Effect, Match, Option, Schema } from "effect";

/**
 * The templates a question may take (K23): a single-answer multiple choice
 * (`choice`); a complex multiple choice (`choices`), whose student checks every
 * correct option; true or false (`truefalse`), a single-answer choice of two
 * fixed options; and cause and effect (`cause`), a single-answer choice of the
 * five fixed relations between a statement and its reason, which the prompt
 * holds; a short answer (`short`), a text entry that the key's accepted
 * answers score; a numeric answer (`numeric`), a number that the key's value,
 * within its tolerance, scores; an essay (`essay`), a long written answer that the teacher
 * scores by the rubric; matching (`match`), where the student pairs each
 * statement with one answer; and a true or false table (`table`), where the
 * student marks each statement true or false; and an answer with its reason
 * (`reason`), two single-answer choices scored as one. A new question starts as
 * `choice`, and each later template adds its member here.
 */
export const QuestionTemplate = Schema.Literals([
  "choice",
  "choices",
  "truefalse",
  "cause",
  "short",
  "numeric",
  "essay",
  "match",
  "table",
  "reason",
]);
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
 * `media` is the JSON text of what the question plays, absent until a teacher adds one. `points` is the weight of the question, and `scoring` the JSON text of the rule that shares
 * it among the parts of an answer, absent until the teacher chooses one. `prompt`, `rubric`, and
 * `explanation` are documents of their own: the question's text, the teacher's scoring
 * guide, and the explanation a learner reads after the result. Each of them is written by
 * the collaborative editor, and each one is frozen with its exam. `reading` is the shared reading
 * the question is asked of, a document several questions may hold, absent until a teacher gives one.
 */
export const questionValidator = Schema.Struct({
  answers: Schema.String,
  examId: Id("exams"),
  explanation: Id("editorDocuments"),
  key: Schema.NullOr(Schema.String),
  media: Schema.optionalKey(Schema.String),
  points: QuestionPoints,
  prompt: Id("editorDocuments"),
  reading: Schema.optionalKey(Id("editorDocuments")),
  revision: Schema.Natural,
  rubric: Id("editorDocuments"),
  scoring: Schema.optionalKey(Schema.String),
  template: QuestionTemplate,
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/**
 * The reading a question takes: a new one the teacher writes, none, or the reading of another question of its
 * exam, so several questions are asked of one text.
 */
export const ReadingSource = Schema.Union([
  Schema.Literals(["new", "none"]),
  Id("examQuestions"),
]);

/** The fewest options a choice holds: a choice of one option asks nothing. */
export const CHOICE_OPTIONS_MIN = 2;

/** The most options a choice holds, which the letters A to E name. */
export const CHOICE_OPTIONS_MAX = 5;

/**
 * The most options one choice of a template takes: every option it holds for a complex choice,
 * whose student checks each correct one, and one for every other template.
 */
export const choiceLimit = (template: QuestionTemplate, options: number) =>
  Match.value(template).pipe(
    Match.when("choices", () => options),
    Match.orElse(() => 1)
  );

/** The options of a true or false question: true and false. */
const TRUE_FALSE_OPTIONS = 2;

/**
 * The options of a cause and effect question: both true and related, both true and unrelated, the
 * statement true and the reason false, the statement false and the reason true, and both false.
 */
const CAUSE_OPTIONS = 5;

/**
 * The number of options a template fixes, or none when the teacher adds and removes them: two for
 * true or false, and five for cause and effect. The editor writes their labels in the teacher's
 * language when the question takes the template, and the teacher may retype them, so a question
 * in any language reads them in its own words.
 */
export const fixedOptions = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("truefalse", () => Option.some(TRUE_FALSE_OPTIONS)),
    Match.when("cause", () => Option.some(CAUSE_OPTIONS)),
    Match.orElse(() => Option.none<number>())
  );

/**
 * Whether a template's question takes a rubric, the teacher's guide to scoring an answer by hand.
 * A choice and a short answer are scored by their key, so neither takes one, and an essay
 * is scored by the teacher, who reads its rubric; the layer shows a rubric only for a
 * template that takes one. Each template decides it here, so a new
 * template cannot leave it undecided.
 */
export const takesRubric = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("choice", () => false),
    Match.when("choices", () => false),
    Match.when("truefalse", () => false),
    Match.when("cause", () => false),
    Match.when("short", () => false),
    Match.when("numeric", () => false),
    Match.when("essay", () => true),
    Match.when("match", () => false),
    Match.when("table", () => false),
    Match.when("reason", () => false),
    Match.exhaustive
  );

/** The columns of a true or false table: true and false. */
export const TABLE_COLUMNS = 2;

/**
 * The labels the editor writes in the teacher's language when a question takes a template: the options a
 * choice template fixes (`fixedOptions`), the two columns of a true or false table, and none for any other.
 */
export const templateLabels = (template: QuestionTemplate) =>
  template === "table"
    ? TABLE_COLUMNS
    : Option.getOrElse(fixedOptions(template), () => 0);

/**
 * Whether a template's question needs an answer key before its exam is scheduled: an essay is scored by
 * the teacher with its rubric, so it needs none, and every other template is scored by its key.
 */
export const needsKey = (template: QuestionTemplate) => !takesRubric(template);

/**
 * Whether a question keeps its exam from being scheduled: its template needs a key (`needsKey`), and it
 * has none, or one that does not fit its interactions (`keyFits`). The schedule refuses such a question,
 * and the schedule dialog names it before the teacher asks.
 */
export const keyMissing = (
  question: Pick<QuestionView, "answers" | "key" | "template">
) =>
  needsKey(question.template) &&
  (question.key === null || !keyFits(question.answers, question.key));

/** The most characters of one fixed option's label, as the editor writes it for the template. */
const OPTION_LABEL_MAX = 200;

/**
 * The labels of the options a template fixes, as plain text in the teacher's language: one
 * for each fixed option (`fixedOptions`), and none for a template whose options the teacher
 * adds.
 */
export const TemplateLabels = Schema.Array(
  Schema.NonEmptyString.check(Schema.isMaxLength(OPTION_LABEL_MAX))
).check(Schema.isMaxLength(CHOICE_OPTIONS_MAX));

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
 * One question as the wire shows it: its ID, its template, its points and the rule that
 * scores them, its prompt, reading, rubric and explanation documents, its interactions, its key (null
 * until one option is marked), and its revision. Only the teacher's editor reads this view; a learner's paper reads the
 * interactions alone, so the key, the rubric, and the explanation never reach it.
 */
export const QuestionView = Schema.Struct({
  answers: Schema.NonEmptyArray(InteractionSchema),
  explanation: Id("editorDocuments"),
  id: Id("examQuestions"),
  key: Schema.NullOr(Schema.NonEmptyArray(InteractionKeySchema)),
  media: Schema.Array(QuestionMedia),
  points: QuestionPoints,
  prompt: Id("editorDocuments"),
  reading: Schema.NullOr(Id("editorDocuments")),
  revision: Schema.Natural,
  rubric: Id("editorDocuments"),
  scoring: DefaultRuleSchema,
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

/** The media of a question as JSON text. */
const MediaText = Schema.fromJsonString(Schema.Array(QuestionMedia));

/** The JSON text a question's media is stored as. */
export const encodeMedia = Effect.fn("exams.question.encodeMedia")(function* (
  media: readonly QuestionMedia[]
) {
  return yield* Schema.encodeEffect(MediaText)(media).pipe(Effect.orDie);
});

/** The media a stored question holds, none until a teacher adds one. A stored text it refuses is a defect. */
export const questionMedia = Effect.fn("exams.question.media")(function* (
  text: ExamQuestionsDoc["media"]
) {
  return text === undefined
    ? []
    : yield* Schema.decodeEffect(MediaText)(text).pipe(Effect.orDie);
});

/** The rule of a question as JSON text, decoded with the contract's rule schema. */
const ScoringText = Schema.fromJsonString(DefaultRuleSchema);

/** The JSON text a question's rule is stored as. */
export const encodeScoring = Effect.fn("exams.question.encodeScoring")(
  function* (rule: typeof DefaultRuleSchema.Type) {
    return yield* Schema.encodeEffect(ScoringText)(rule).pipe(Effect.orDie);
  }
);

/**
 * The rule a stored question scores by: the one its teacher chose while its template has parts to share its
 * points among, and all or nothing otherwise, so a rule kept through a change of template never pays a wrong
 * answer. A stored text that the contract refuses is a defect.
 */
const decodeScoring = Effect.fn("exams.question.scoring")(function* (
  row: Pick<ExamQuestionsDoc, "scoring" | "template">
) {
  if (row.scoring === undefined || !takesScoring(row.template)) {
    return ALL_OR_NOTHING;
  }
  return yield* Schema.decodeEffect(ScoringText)(row.scoring).pipe(
    Effect.orDie
  );
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
    media: yield* questionMedia(row.media),
    points: row.points,
    prompt: row.prompt,
    reading: row.reading ?? null,
    revision: row.revision,
    rubric: row.rubric,
    scoring: yield* decodeScoring(row),
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
