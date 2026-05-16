import {
  boundInputSchema,
  pointInputSchema,
  valueInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

export const mathProbabilityDistributions = [
  "bernoulli",
  "binomial",
  "normal",
  "poisson",
  "uniform",
] as const;

const probabilityDistributionParameters = {
  bernoulli: ["p"],
  binomial: ["n", "p"],
  normal: ["mean", "standard_deviation"],
  poisson: ["lambda"],
  uniform: ["lower", "upper"],
} as const;

const probabilityDistributionSchema = Schema.Literal(
  ...mathProbabilityDistributions
).annotations({
  description:
    "Supported probability distribution: bernoulli, binomial, normal, poisson, or uniform.",
});

export const probabilityParametersSchema = Schema.Struct({
  lambda: Schema.optional(valueInputSchema),
  lower: Schema.optional(valueInputSchema),
  mean: Schema.optional(valueInputSchema),
  n: Schema.optional(valueInputSchema),
  p: Schema.optional(valueInputSchema),
  standard_deviation: Schema.optional(valueInputSchema),
  standardDeviation: Schema.optional(valueInputSchema),
  upper: Schema.optional(valueInputSchema),
})
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Distribution parameters. Bernoulli uses p; binomial uses n and p; normal uses mean and standard_deviation; poisson uses lambda; uniform uses lower and upper.",
  });

const probabilityInclusiveSchema = Schema.Boolean.annotations({
  description:
    "Whether the probability bound includes the endpoint. Defaults to true when omitted.",
});

const MathProbabilityBaseInputSchema = Schema.Struct({
  distribution: probabilityDistributionSchema,
  parameters: probabilityParametersSchema,
  variable: Schema.optional(variableInputSchema),
});

type ProbabilityBaseInput = Schema.Schema.Type<
  typeof MathProbabilityBaseInputSchema
>;

/** Checks that the selected named distribution receives all required parameters. */
function hasRequiredProbabilityParameters(value: ProbabilityBaseInput) {
  return probabilityDistributionParameters[value.distribution].every(
    (parameter) => Boolean(value.parameters[parameter])
  );
}

const MathProbabilitySummaryInputSchema = Schema.extend(
  MathProbabilityBaseInputSchema,
  Schema.Struct({
    operation: Schema.Literal(
      "distribution",
      "expected_value",
      "variance_probability"
    ).annotations({
      description:
        "Use distribution to inspect a supported named distribution, expected_value for expectation, or variance_probability for variance.",
    }),
  })
)
  .pipe(
    Schema.filter((value) => hasRequiredProbabilityParameters(value), {
      message: () =>
        "Expected required distribution parameters for the selected probability distribution.",
    })
  )
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Named distribution summary, expected value, or variance input.",
  });

const MathProbabilityPointInputSchema = Schema.extend(
  MathProbabilityBaseInputSchema,
  Schema.Struct({
    operation: Schema.Literal("point_probability").annotations({
      description: "Use for exact-value probability such as P(X = 3).",
    }),
    point: pointInputSchema.annotations({
      description: "Exact event value, for example 3.",
    }),
  })
)
  .pipe(
    Schema.filter((value) => hasRequiredProbabilityParameters(value), {
      message: () =>
        "Expected required distribution parameters for the selected probability distribution.",
    })
  )
  .pipe(Schema.mutable)
  .annotations({ description: "Exact-value probability input." });

const MathProbabilityCumulativeInputSchema = Schema.extend(
  MathProbabilityBaseInputSchema,
  Schema.Struct({
    inclusive: Schema.optional(probabilityInclusiveSchema),
    operation: Schema.Literal("cumulative_probability").annotations({
      description: "Use for below, less-than, at-most, or up-to events.",
    }),
    upper: boundInputSchema.annotations({
      description: "Upper event bound, for example 85.",
    }),
  })
)
  .pipe(
    Schema.filter((value) => hasRequiredProbabilityParameters(value), {
      message: () =>
        "Expected required distribution parameters for the selected probability distribution.",
    })
  )
  .pipe(Schema.mutable)
  .annotations({ description: "Cumulative probability input." });

const MathProbabilityTailInputSchema = Schema.extend(
  MathProbabilityBaseInputSchema,
  Schema.Struct({
    inclusive: Schema.optional(probabilityInclusiveSchema),
    lower: boundInputSchema.annotations({
      description: "Lower event bound, for example 85.",
    }),
    operation: Schema.Literal("tail_probability").annotations({
      description: "Use for above, greater-than, at-least, or from events.",
    }),
  })
)
  .pipe(
    Schema.filter((value) => hasRequiredProbabilityParameters(value), {
      message: () =>
        "Expected required distribution parameters for the selected probability distribution.",
    })
  )
  .pipe(Schema.mutable)
  .annotations({ description: "Tail probability input." });

const MathProbabilityIntervalInputSchema = Schema.extend(
  MathProbabilityBaseInputSchema,
  Schema.Struct({
    lower: boundInputSchema.annotations({
      description: "Lower event bound, for example 60.",
    }),
    lowerInclusive: Schema.optional(probabilityInclusiveSchema),
    operation: Schema.Literal("interval_probability").annotations({
      description:
        "Use for between-range events. Always include both lower and upper.",
    }),
    upper: boundInputSchema.annotations({
      description: "Upper event bound, for example 85.",
    }),
    upperInclusive: Schema.optional(probabilityInclusiveSchema),
  })
)
  .pipe(
    Schema.filter((value) => hasRequiredProbabilityParameters(value), {
      message: () =>
        "Expected required distribution parameters for the selected probability distribution.",
    })
  )
  .pipe(Schema.mutable)
  .annotations({ description: "Interval probability input." });

export const MathProbabilityInputSchema = Schema.Union(
  MathProbabilitySummaryInputSchema,
  MathProbabilityPointInputSchema,
  MathProbabilityCumulativeInputSchema,
  MathProbabilityTailInputSchema,
  MathProbabilityIntervalInputSchema
)
  .pipe(Schema.mutable)
  .annotations({ description: "Probability distribution tool input." });
