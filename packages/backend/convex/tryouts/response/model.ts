import { type Infer, v } from "convex/values";

const responseOptionValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const runtimeResponseOptionValidator = responseOptionValidator
  .omit("isCorrect")
  .extend({ isCorrect: v.optional(v.boolean()) });

const responseCategoryValidator = v.object({
  categoryKey: v.string(),
  label: v.string(),
  order: v.number(),
});

const responseStatementValidator = v.object({
  correctCategoryKey: v.string(),
  label: v.string(),
  order: v.number(),
  statementKey: v.string(),
});

const runtimeResponseStatementValidator = responseStatementValidator
  .omit("correctCategoryKey")
  .extend({ correctCategoryKey: v.optional(v.string()) });

/** Immutable single-choice response accepted by single-choice consumers. */
export const tryoutSingleChoiceResponseSpecValidator = v.object({
  kind: v.literal("single-choice"),
  options: v.array(responseOptionValidator),
});

/** Complete immutable response definition frozen into one attempt placement. */
export const tryoutResponseSpecValidator = v.union(
  tryoutSingleChoiceResponseSpecValidator,
  v.object({
    kind: v.literal("multiple-choice"),
    options: v.array(responseOptionValidator),
  }),
  v.object({
    categories: v.array(responseCategoryValidator),
    kind: v.literal("category"),
    statements: v.array(responseStatementValidator),
  })
);

/** Public response definition whose answer key is present only in review. */
export const tryoutRuntimeResponseSpecValidator = v.union(
  v.object({
    kind: v.literal("single-choice"),
    options: v.array(runtimeResponseOptionValidator),
  }),
  v.object({
    kind: v.literal("multiple-choice"),
    options: v.array(runtimeResponseOptionValidator),
  }),
  v.object({
    categories: v.array(responseCategoryValidator),
    kind: v.literal("category"),
    statements: v.array(runtimeResponseStatementValidator),
  })
);

const categoryAssignmentValidator = v.object({
  categoryKey: v.string(),
  statementKey: v.string(),
});

/** Learner-owned response selection independent from answer-key content. */
export const tryoutResponseSelectionValidator = v.union(
  v.object({
    kind: v.literal("single-choice"),
    optionKey: v.string(),
  }),
  v.object({
    kind: v.literal("multiple-choice"),
    optionKeys: v.array(v.string()),
  }),
  v.object({
    assignments: v.array(categoryAssignmentValidator),
    kind: v.literal("category"),
  })
);

export type TryoutResponseSpec = Infer<typeof tryoutResponseSpecValidator>;
export type TryoutRuntimeResponseSpec = Infer<
  typeof tryoutRuntimeResponseSpecValidator
>;
export type TryoutResponseSelection = Infer<
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
          ? { correctCategoryKey: statement.correctCategoryKey }
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
      ...(revealAnswers ? { isCorrect: option.isCorrect } : {}),
      label: option.label,
      optionKey: option.optionKey,
      order: option.order,
    })),
  };
}
