import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import {
  QuestionAnswerKeySchema,
  QuestionDecimalSchema,
} from "@nakafa/aksara-contracts/question/answer";
import {
  QuestionRubricLabelSchema,
  QuestionRubricResponseSchema,
} from "@nakafa/aksara-contracts/question/rubric";
import { Schema, Struct } from "effect";

/** Longest typed short answer or final answer: one line a learner can type. */
const TYPED_ANSWER_LENGTH = 500;

/** Longest written rubric response, a Markdown answer with math. */
const WRITTEN_ANSWER_LENGTH = 50_000;

/** Largest number of typed final answers one rubric response can carry. */
const FINAL_ANSWER_LIMIT = 64;

const Option = Schema.Struct({
  isCorrect: Schema.Boolean,
  label: Schema.String,
  optionKey: Schema.String,
  order: Schema.Finite,
});
const RenderableOption = Schema.Struct({
  ...Option.mapFields(Struct.omit(["isCorrect"])).fields,
  isCorrect: Schema.optionalKey(Schema.Boolean),
});
const Category = Schema.Struct({
  categoryKey: Schema.String,
  label: Schema.String,
  order: Schema.Finite,
});
const Statement = Schema.Struct({
  correctCategoryKey: Schema.String,
  label: Schema.String,
  order: Schema.Finite,
  statementKey: Schema.String,
});
const RenderableStatement = Schema.Struct({
  ...Statement.mapFields(Struct.omit(["correctCategoryKey"])).fields,
  correctCategoryKey: Schema.optionalKey(Schema.String),
});
const RubricLevel = Schema.Struct({
  label: QuestionRubricLabelSchema,
  levelKey: Schema.String,
  order: Schema.Finite,
  points: Schema.Finite,
});

/**
 * One rubric criterion as learners see it. `final` marks a criterion graded
 * from a typed final answer; its key, label, and levels arrive only in review.
 */
const RenderableCriterion = Schema.Struct({
  criterionKey: Schema.String,
  final: Schema.Boolean,
  finalAnswer: Schema.optionalKey(QuestionAnswerKeySchema),
  label: Schema.optionalKey(QuestionRubricLabelSchema),
  levels: Schema.optionalKey(Schema.Array(RubricLevel)),
  order: Schema.Finite,
});

/**
 * Complete immutable response frozen into one placement, answer key included.
 * Typed answers are read in `language`, the delivery language of the question.
 */
export const ResponseSpec = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single-choice"),
    options: Schema.Array(Option),
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple-choice"),
    options: Schema.Array(Option),
  }),
  Schema.Struct({
    categories: Schema.Array(Category),
    kind: Schema.Literal("category"),
    statements: Schema.Array(Statement),
  }),
  Schema.Struct({
    key: QuestionAnswerKeySchema,
    kind: Schema.Literal("short-answer"),
    language: DeliveryLanguageSchema,
  }),
  Schema.Struct({
    ...QuestionRubricResponseSchema.fields,
    language: DeliveryLanguageSchema,
  }),
]).pipe(Schema.toTaggedUnion("kind"));
export type ResponseSpec = typeof ResponseSpec.Type;

/** Response definition sent to learners, whose answer key is present only in review. */
export const RenderableSpec = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single-choice"),
    options: Schema.Array(RenderableOption),
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple-choice"),
    options: Schema.Array(RenderableOption),
  }),
  Schema.Struct({
    categories: Schema.Array(Category),
    kind: Schema.Literal("category"),
    statements: Schema.Array(RenderableStatement),
  }),
  Schema.Struct({
    key: Schema.optionalKey(QuestionAnswerKeySchema),
    kind: Schema.Literal("short-answer"),
    language: DeliveryLanguageSchema,
  }),
  Schema.Struct({
    criteria: Schema.Array(RenderableCriterion),
    kind: Schema.Literal("rubric"),
    language: DeliveryLanguageSchema,
  }),
]).pipe(Schema.toTaggedUnion("kind"));
export type RenderableSpec = typeof RenderableSpec.Type;

const TypedAnswer = Schema.String.check(
  Schema.isMaxLength(TYPED_ANSWER_LENGTH)
);

/** A typed fraction as read: a canonical integer over a positive integer. */
const FRACTION_READING = /^(?:0|-?[1-9]\d*)\/[1-9]\d*$/u;

const isDecimal = Schema.is(QuestionDecimalSchema);

/**
 * Exact number a numeric key read from a typed answer in its delivery
 * language: the contract's canonical decimal, such as `0.5`, or a typed
 * fraction, such as `3/4`. It is absent for text keys and unreadable text.
 */
const Reading = Schema.optionalKey(
  Schema.String.check(
    Schema.makeFilter(
      (reading) => isDecimal(reading) || FRACTION_READING.test(reading),
      { message: "Expected a canonical decimal or an integer fraction." }
    )
  )
);

/**
 * Learner-owned answer in canonical form. Typed answers keep the raw text; the
 * reading of a numeric answer is always recomputed by `evaluate`.
 */
export const Selection = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single-choice"),
    optionKey: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple-choice"),
    optionKeys: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    assignments: Schema.Array(
      Schema.Struct({
        categoryKey: Schema.String,
        statementKey: Schema.String,
      })
    ),
    kind: Schema.Literal("category"),
  }),
  Schema.Struct({
    kind: Schema.Literal("short-answer"),
    number: Reading,
    text: TypedAnswer,
  }),
  Schema.Struct({
    finalAnswers: Schema.Array(
      Schema.Struct({
        criterionKey: Schema.String,
        number: Reading,
        text: TypedAnswer,
      })
    ).check(Schema.isMaxLength(FINAL_ANSWER_LIMIT)),
    kind: Schema.Literal("rubric"),
    text: Schema.String.check(Schema.isMaxLength(WRITTEN_ANSWER_LENGTH)),
  }),
]).pipe(Schema.toTaggedUnion("kind"));
export type Selection = typeof Selection.Type;

/**
 * How one answer scores. Worth comes only from the contract's
 * `questionPoints`; `partial` earns `points` between zero and that worth, and
 * `pending` awaits the grader and is never counted as zero.
 */
export const Outcome = Schema.Union([
  Schema.Struct({ status: Schema.Literal("correct") }),
  Schema.Struct({ status: Schema.Literal("incorrect") }),
  Schema.Struct({
    points: Schema.Finite.check(Schema.isGreaterThan(0)),
    status: Schema.Literal("partial"),
  }),
  Schema.Struct({ status: Schema.Literal("pending") }),
]).pipe(Schema.toTaggedUnion("status"));
export type Outcome = typeof Outcome.Type;

/** A selection that belongs to its response, in canonical form. */
export const Selected = Schema.Struct({
  isComplete: Schema.Boolean,
  selection: Selection,
});
export type Selected = typeof Selected.Type;

/** A canonical selection and how it scores. */
export const Evaluated = Schema.Struct({
  ...Selected.fields,
  outcome: Outcome,
});
export type Evaluated = typeof Evaluated.Type;

/**
 * A selection does not belong to its response: `kind` names another response
 * format, and `selection` names keys or text the response cannot accept.
 */
export class ResponseRejected extends Schema.TaggedError<ResponseRejected>()(
  "ResponseRejected",
  {
    reason: Schema.Literals(["kind", "selection"]),
  }
) {}
