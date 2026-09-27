import { Schema, Struct } from "effect";

const responseOptionValidator = Schema.Struct({
  isCorrect: Schema.Boolean,
  label: Schema.String,
  optionKey: Schema.String,
  order: Schema.Finite,
});
const runtimeResponseOptionValidator = Schema.Struct({
  ...responseOptionValidator.mapFields(Struct.omit(["isCorrect"])).fields,
  ...{
    isCorrect: Schema.optionalKey(Schema.Boolean),
  },
});
const responseCategoryValidator = Schema.Struct({
  categoryKey: Schema.String,
  label: Schema.String,
  order: Schema.Finite,
});
const responseStatementValidator = Schema.Struct({
  correctCategoryKey: Schema.String,
  label: Schema.String,
  order: Schema.Finite,
  statementKey: Schema.String,
});
const runtimeResponseStatementValidator = Schema.Struct({
  ...responseStatementValidator.mapFields(Struct.omit(["correctCategoryKey"]))
    .fields,
  ...{
    correctCategoryKey: Schema.optionalKey(Schema.String),
  },
});

/** Complete immutable response definition frozen into one attempt placement. */
export const tryoutResponseSpecValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single-choice"),
    options: Schema.mutable(Schema.Array(responseOptionValidator)),
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple-choice"),
    options: Schema.mutable(Schema.Array(responseOptionValidator)),
  }),
  Schema.Struct({
    categories: Schema.mutable(Schema.Array(responseCategoryValidator)),
    kind: Schema.Literal("category"),
    statements: Schema.mutable(Schema.Array(responseStatementValidator)),
  }),
]);

/** Public response definition whose answer key is present only in review. */
export const tryoutRuntimeResponseSpecValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single-choice"),
    options: Schema.mutable(Schema.Array(runtimeResponseOptionValidator)),
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple-choice"),
    options: Schema.mutable(Schema.Array(runtimeResponseOptionValidator)),
  }),
  Schema.Struct({
    categories: Schema.mutable(Schema.Array(responseCategoryValidator)),
    kind: Schema.Literal("category"),
    statements: Schema.mutable(Schema.Array(runtimeResponseStatementValidator)),
  }),
]);
const categoryAssignmentValidator = Schema.Struct({
  categoryKey: Schema.String,
  statementKey: Schema.String,
});

/** Learner-owned response selection independent from answer-key content. */
export const tryoutResponseSelectionValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single-choice"),
    optionKey: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple-choice"),
    optionKeys: Schema.mutable(Schema.Array(Schema.String)),
  }),
  Schema.Struct({
    assignments: Schema.mutable(Schema.Array(categoryAssignmentValidator)),
    kind: Schema.Literal("category"),
  }),
]);
export type TryoutResponseSpec = Schema.Schema.Type<
  typeof tryoutResponseSpecValidator
>;
export type TryoutRuntimeResponseSpec = Schema.Schema.Type<
  typeof tryoutRuntimeResponseSpecValidator
>;
export type TryoutResponseSelection = Schema.Schema.Type<
  typeof tryoutResponseSelectionValidator
>;

/** Removes answer-key facts unless the attempt grants terminal review access. */
export function projectTryoutResponseSpec(
  responseSpec: TryoutResponseSpec,
  revealAnswers: boolean
): TryoutRuntimeResponseSpec {
  if (responseSpec.kind === "category") {
    return {
      categories: responseSpec.categories,
      kind: responseSpec.kind,
      statements: responseSpec.statements.map((statement) => ({
        ...(revealAnswers
          ? {
              correctCategoryKey: statement.correctCategoryKey,
            }
          : {}),
        label: statement.label,
        order: statement.order,
        statementKey: statement.statementKey,
      })),
    };
  }
  return {
    kind: responseSpec.kind,
    options: responseSpec.options.map((option) => ({
      ...(revealAnswers
        ? {
            isCorrect: option.isCorrect,
          }
        : {}),
      label: option.label,
      optionKey: option.optionKey,
      order: option.order,
    })),
  };
}
