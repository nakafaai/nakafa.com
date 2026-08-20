import {
  boundInputSchema,
  expressionInputSchema,
  getExpressionSymbols,
  pointInputSchema,
  valueInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";
export const mathProbabilityDistributions = [
  "bernoulli",
  "binomial",
  "normal",
  "poisson",
  "uniform",
] as const;
const probabilityDistributionSchema = Schema.Literals(
  mathProbabilityDistributions
).annotate({
  description:
    "Supported probability distribution: bernoulli, binomial, normal, poisson, or uniform.",
});
export const probabilityParametersSchema = Schema.Struct({
  lambda: Schema.optionalKey(valueInputSchema),
  lower: Schema.optionalKey(valueInputSchema),
  mean: Schema.optionalKey(valueInputSchema),
  n: Schema.optionalKey(valueInputSchema),
  p: Schema.optionalKey(valueInputSchema),
  standard_deviation: Schema.optionalKey(valueInputSchema),
  upper: Schema.optionalKey(valueInputSchema),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description:
      "Distribution parameters. Bernoulli uses p; binomial uses n and p; normal uses mean and standard_deviation; poisson uses lambda; uniform uses lower and upper.",
  });
const probabilityInclusiveSchema = Schema.Boolean.annotate({
  description:
    "Whether the probability bound includes the endpoint. Defaults to true when omitted.",
});
const MathProbabilityBaseInputSchema = Schema.Struct({
  distribution: probabilityDistributionSchema,
  parameters: probabilityParametersSchema,
  variable: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Random variable name. For transformed moments, keep this as the underlying random variable and put the transformed target in expression. The expression must use this same variable.",
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
});
type ProbabilityBaseInput = Schema.Schema.Type<
  typeof MathProbabilityBaseInputSchema
>;
type ProbabilityParameter = keyof ProbabilityBaseInput["parameters"];
type ProbabilityMomentInput = ProbabilityBaseInput & {
  expression?: string;
  operation: "expected_value" | "variance_probability";
};
const probabilityDistributionParameters = {
  bernoulli: ["p"],
  binomial: ["n", "p"],
  normal: ["mean", "standard_deviation"],
  poisson: ["lambda"],
  uniform: ["lower", "upper"],
} satisfies Record<
  (typeof mathProbabilityDistributions)[number],
  readonly ProbabilityParameter[]
>;
/** Checks that the selected named distribution receives all required parameters. */
function hasRequiredProbabilityParameters(value: ProbabilityBaseInput) {
  return probabilityDistributionParameters[value.distribution].every(
    (parameter) => Boolean(value.parameters[parameter])
  );
}
/** Checks that a transformed moment targets one configured random variable. */
function hasConsistentMomentExpression(value: ProbabilityMomentInput) {
  if (!value.expression) {
    return true;
  }
  const symbols = getExpressionSymbols(value.expression);
  if (symbols.size !== 1) {
    return false;
  }
  if (!value.variable) {
    return true;
  }
  return symbols.has(value.variable);
}
const MathProbabilityDistributionInputSchema =
  MathProbabilityBaseInputSchema.mapFields(
    (fields) => ({
      ...fields,
      operation: Schema.Literal("distribution").annotate({
        description:
          "Use distribution to inspect a supported named distribution.",
      }),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .check(
      Schema.makeFilter((value) => hasRequiredProbabilityParameters(value), {
        message:
          "Expected required distribution parameters for the selected probability distribution.",
      })
    )
    .annotate({ description: "Named distribution summary input." });
const MathProbabilityMomentInputSchema =
  MathProbabilityBaseInputSchema.mapFields(
    (fields) => ({
      ...fields,
      expression: Schema.optionalKey(
        expressionInputSchema.annotate({
          description:
            "Optional transformed random-variable expression for expected_value or variance_probability. Use when the requested moment is about a transformation of the random variable. It must contain exactly one random variable and match variable when variable is provided.",
        })
      ),
      operation: Schema.Literals([
        "expected_value",
        "variance_probability",
      ]).annotate({
        description:
          "Use expected_value for expectation or variance_probability for variance.",
      }),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .check(
      Schema.makeFilter((value) => hasRequiredProbabilityParameters(value), {
        message:
          "Expected required distribution parameters for the selected probability distribution.",
      })
    )
    .check(
      Schema.makeFilter((value) => hasConsistentMomentExpression(value), {
        message:
          "Expected the moment expression to contain exactly one random variable, matching variable when provided.",
      })
    )
    .annotate({
      description: "Named distribution expected value or variance input.",
    });
const MathProbabilityPointInputSchema =
  MathProbabilityBaseInputSchema.mapFields(
    (fields) => ({
      ...fields,
      operation: Schema.Literal("point_probability").annotate({
        description: "Use for exact-value probability such as P(X = 3).",
      }),
      point: pointInputSchema.annotate({
        description: "Exact event value, for example 3.",
      }),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .check(
      Schema.makeFilter((value) => hasRequiredProbabilityParameters(value), {
        message:
          "Expected required distribution parameters for the selected probability distribution.",
      })
    )
    .annotate({ description: "Exact-value probability input." });
const MathProbabilityCumulativeInputSchema =
  MathProbabilityBaseInputSchema.mapFields(
    (fields) => ({
      ...fields,
      inclusive: Schema.optionalKey(probabilityInclusiveSchema),
      operation: Schema.Literal("cumulative_probability").annotate({
        description: "Use for below, less-than, at-most, or up-to events.",
      }),
      upper: boundInputSchema.annotate({
        description: "Upper event bound, for example 85.",
      }),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .check(
      Schema.makeFilter((value) => hasRequiredProbabilityParameters(value), {
        message:
          "Expected required distribution parameters for the selected probability distribution.",
      })
    )
    .annotate({ description: "Cumulative probability input." });
const MathProbabilityTailInputSchema = MathProbabilityBaseInputSchema.mapFields(
  (fields) => ({
    ...fields,
    inclusive: Schema.optionalKey(probabilityInclusiveSchema),
    lower: boundInputSchema.annotate({
      description: "Lower event bound, for example 85.",
    }),
    operation: Schema.Literal("tail_probability").annotate({
      description: "Use for above, greater-than, at-least, or from events.",
    }),
  }),
  { unsafePreserveChecks: true }
)
  .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
  .check(
    Schema.makeFilter((value) => hasRequiredProbabilityParameters(value), {
      message:
        "Expected required distribution parameters for the selected probability distribution.",
    })
  )
  .annotate({ description: "Tail probability input." });
const MathProbabilityIntervalInputSchema =
  MathProbabilityBaseInputSchema.mapFields(
    (fields) => ({
      ...fields,
      lower: boundInputSchema.annotate({
        description: "Lower event bound, for example 60.",
      }),
      lowerInclusive: Schema.optionalKey(probabilityInclusiveSchema),
      operation: Schema.Literal("interval_probability").annotate({
        description:
          "Use for between-range events. Always include both lower and upper.",
      }),
      upper: boundInputSchema.annotate({
        description: "Upper event bound, for example 85.",
      }),
      upperInclusive: Schema.optionalKey(probabilityInclusiveSchema),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .check(
      Schema.makeFilter((value) => hasRequiredProbabilityParameters(value), {
        message:
          "Expected required distribution parameters for the selected probability distribution.",
      })
    )
    .annotate({ description: "Interval probability input." });
export const MathProbabilityInputSchema = Schema.Union([
  MathProbabilityDistributionInputSchema,
  MathProbabilityMomentInputSchema,
  MathProbabilityPointInputSchema,
  MathProbabilityCumulativeInputSchema,
  MathProbabilityTailInputSchema,
  MathProbabilityIntervalInputSchema,
]).annotate({ description: "Probability distribution tool input." });
