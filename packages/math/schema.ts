import { Schema } from "effect";

const expressionInputSchema = Schema.NonEmptyString.annotations({
  description:
    "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
});

const variableInputSchema = Schema.NonEmptyString.annotations({
  description:
    "The variable to use for this operation, for example x, y, or t.",
});

const boundInputSchema = Schema.NonEmptyString.annotations({
  description:
    "A bound or endpoint for a finite calculation, for example 0, 1, or pi.",
});

const valueInputSchema = Schema.NonEmptyString.annotations({
  description:
    "A numeric or symbolic value represented as text so exact math is preserved.",
});

const pointInputSchema = Schema.NonEmptyString.annotations({
  description:
    "The point where the operation is evaluated, for example 0, oo, or pi.",
});

export const MathOperationSchema = Schema.Literal(
  "apart",
  "cancel",
  "circle",
  "combination",
  "compare",
  "determinant",
  "differentiate",
  "distance",
  "distribution",
  "domain",
  "eigenvalues",
  "eigenvectors",
  "evaluate",
  "expected_value",
  "expand",
  "factor",
  "gcd",
  "integrate",
  "intersection",
  "inverse",
  "is_prime",
  "lcm",
  "limit",
  "line",
  "linear_system",
  "matrix_multiply",
  "mean",
  "median",
  "midpoint",
  "mode",
  "modular",
  "permutation",
  "prime_factorization",
  "product",
  "quartiles",
  "rank",
  "rationalize",
  "roots",
  "rref",
  "series",
  "simplify",
  "slope",
  "solve",
  "standard_deviation",
  "summation",
  "together",
  "variance",
  "variance_probability",
  "z_score"
);

export const MathStatusSchema = Schema.Literal(
  "verified",
  "contradicted",
  "inconclusive"
);

export const MathStepStatusSchema = Schema.Literal(
  "complete",
  "partial",
  "unavailable"
).annotations({
  description:
    "Whether the CAS could provide complete, partial, or unavailable derivation steps.",
});

export const MathExpressionSchema = Schema.Struct({
  expression: expressionInputSchema,
  latex: Schema.String.annotations({
    description: "LaTeX representation of the expression for rendering.",
  }),
}).pipe(Schema.mutable);

export const MathItemSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: "Short student-facing label for the math item.",
  }),
  latex: Schema.optional(
    Schema.String.annotations({
      description: "Optional LaTeX representation for display.",
    })
  ),
  value: valueInputSchema,
}).pipe(Schema.mutable);

export const MathStepSchema = Schema.Struct({
  action: Schema.NonEmptyString.annotations({
    description:
      "CAS step action, for example divide, factor, cancel, or compare.",
  }),
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  primary: MathExpressionSchema,
  relation: Schema.optional(MathExpressionSchema),
  secondary: Schema.optional(MathExpressionSchema),
})
  .pipe(Schema.mutable)
  .annotations({
    description:
      "One deterministic math step emitted by the CAS for student-facing evidence.",
  });

export const MathPointSchema = Schema.Struct({
  x: valueInputSchema,
  y: valueInputSchema,
}).pipe(Schema.mutable);

const stringArraySchema = Schema.Array(valueInputSchema).pipe(Schema.mutable);

const pointArraySchema = Schema.Array(MathPointSchema).pipe(Schema.mutable);

const matrixSchema = Schema.Array(
  Schema.Array(valueInputSchema).pipe(Schema.mutable)
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Matrix rows as nested arrays of exact string values, for example [[1, 2], [3, 4]].",
  });

export const MathArithmeticInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("evaluate").annotations({
    description: "Evaluate an exact arithmetic or numeric expression.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Exact arithmetic tool input." });

export const MathAlgebraInputSchema = Schema.Struct({
  expression: Schema.optional(expressionInputSchema),
  left: Schema.optional(expressionInputSchema),
  operation: Schema.Literal(
    "apart",
    "cancel",
    "compare",
    "domain",
    "expand",
    "factor",
    "rationalize",
    "simplify",
    "together"
  ).annotations({
    description:
      "Choose the algebra operation: simplify, factor, expand, cancel, combine, rationalize, domain, or compare.",
  }),
  right: Schema.optional(expressionInputSchema),
  variable: Schema.optional(variableInputSchema),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Symbolic algebra tool input." });

export const MathEquationInputSchema = Schema.Struct({
  expression: Schema.optional(expressionInputSchema),
  expressions: Schema.optional(
    stringArraySchema.annotations({
      description: "Equations or inequalities for systems.",
    })
  ),
  operation: Schema.Literal("roots", "solve").annotations({
    description: "Solve equations, systems, inequalities, or polynomial roots.",
  }),
  variable: Schema.optional(variableInputSchema),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Equation solving tool input." });

export const MathCalculusInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  lower: Schema.optional(boundInputSchema),
  operation: Schema.Literal("differentiate", "integrate", "limit").annotations({
    description: "Differentiate, integrate, or find a limit.",
  }),
  point: Schema.optional(pointInputSchema),
  upper: Schema.optional(boundInputSchema),
  variable: Schema.optional(variableInputSchema),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Calculus tool input." });

export const MathSeriesInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  lower: Schema.optional(boundInputSchema),
  operation: Schema.Literal("product", "series", "summation").annotations({
    description: "Compute a series expansion, summation, or product.",
  }),
  order: Schema.optional(
    Schema.Number.annotations({
      description: "Series expansion order when operation is series.",
    })
  ),
  point: Schema.optional(pointInputSchema),
  upper: Schema.optional(boundInputSchema),
  variable: Schema.optional(variableInputSchema),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Series, summation, and product tool input." });

export const MathMatrixInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal(
    "determinant",
    "eigenvalues",
    "eigenvectors",
    "inverse",
    "linear_system",
    "matrix_multiply",
    "rank",
    "rref"
  ).annotations({
    description:
      "Choose the linear algebra operation for the provided matrix data.",
  }),
  right_matrix: Schema.optional(matrixSchema),
  vector: Schema.optional(
    stringArraySchema.annotations({
      description: "Right-hand side vector for a linear system.",
    })
  ),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Linear algebra tool input." });

export const MathStatisticsInputSchema = Schema.Struct({
  expression: Schema.optional(expressionInputSchema),
  operation: Schema.Literal(
    "mean",
    "median",
    "mode",
    "quartiles",
    "standard_deviation",
    "variance",
    "z_score"
  ).annotations({
    description: "Choose the descriptive statistics operation.",
  }),
  values: stringArraySchema.annotations({
    description: "Dataset values as exact strings.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Statistics tool input." });

export const MathProbabilityInputSchema = Schema.Struct({
  distribution: Schema.NonEmptyString.annotations({
    description:
      "Named probability distribution, for example normal, binomial, or poisson.",
  }),
  operation: Schema.Literal(
    "distribution",
    "expected_value",
    "variance_probability"
  ).annotations({
    description:
      "Inspect a distribution or compute its expected value or variance.",
  }),
  parameters: Schema.Record({ key: Schema.String, value: valueInputSchema })
    .pipe(Schema.mutable)
    .annotations({
      description:
        "Distribution parameters by name, for example mean, standard_deviation, n, or p.",
    }),
  variable: Schema.optional(variableInputSchema),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Probability distribution tool input." });

export const MathGeometryInputSchema = Schema.Struct({
  expressions: Schema.optional(stringArraySchema),
  operation: Schema.Literal(
    "circle",
    "distance",
    "intersection",
    "line",
    "midpoint",
    "slope"
  ).annotations({
    description: "Choose the coordinate geometry operation.",
  }),
  points: Schema.optional(
    pointArraySchema.annotations({
      description: "Coordinate points for geometry operations.",
    })
  ),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Coordinate geometry tool input." });

export const MathDiscreteInputSchema = Schema.Struct({
  k: Schema.optional(valueInputSchema),
  modulus: Schema.optional(valueInputSchema),
  n: Schema.optional(valueInputSchema),
  operation: Schema.Literal(
    "combination",
    "gcd",
    "is_prime",
    "lcm",
    "modular",
    "permutation",
    "prime_factorization"
  ).annotations({
    description: "Choose the discrete math or number theory operation.",
  }),
  values: Schema.optional(stringArraySchema),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Discrete math and number theory tool input." });

export const MathRequestSchema = Schema.Struct({
  distribution: Schema.optional(Schema.String),
  expression: Schema.optional(Schema.String),
  expressions: Schema.optional(stringArraySchema),
  k: Schema.optional(Schema.String),
  kind: Schema.Literal("math"),
  left: Schema.optional(Schema.String),
  lower: Schema.optional(Schema.String),
  matrix: Schema.optional(matrixSchema),
  modulus: Schema.optional(Schema.String),
  n: Schema.optional(Schema.String),
  operation: MathOperationSchema,
  order: Schema.optional(Schema.Number),
  parameters: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
  point: Schema.optional(Schema.String),
  points: Schema.optional(pointArraySchema),
  right: Schema.optional(Schema.String),
  right_matrix: Schema.optional(matrixSchema),
  upper: Schema.optional(Schema.String),
  values: Schema.optional(stringArraySchema),
  variable: Schema.optional(Schema.String),
  variables: Schema.optional(stringArraySchema),
  vector: Schema.optional(stringArraySchema),
}).pipe(Schema.mutable);

export const MathResultSchema = Schema.Struct({
  conditions: Schema.Array(MathExpressionSchema).pipe(Schema.mutable),
  input: MathRequestSchema,
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  kind: MathOperationSchema,
  operation: MathOperationSchema,
  primary: MathExpressionSchema,
  reason: Schema.String,
  secondary: Schema.optional(MathExpressionSchema),
  stepStatus: MathStepStatusSchema,
  steps: Schema.Array(MathStepSchema).pipe(Schema.mutable),
  status: MathStatusSchema,
}).pipe(Schema.mutable);

const mathLoadingDataSchema = Schema.Struct({
  input: MathRequestSchema,
  kind: MathOperationSchema,
  status: Schema.Literal("loading"),
}).pipe(Schema.mutable);

const mathDoneDataSchema = Schema.Struct({
  input: MathRequestSchema,
  kind: MathOperationSchema,
  result: MathResultSchema,
  status: MathStatusSchema,
  summary: Schema.String,
}).pipe(Schema.mutable);

const mathErrorDataSchema = Schema.Struct({
  error: Schema.String,
  input: MathRequestSchema,
  kind: MathOperationSchema,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

export const MathDataSchema = Schema.Union(
  mathLoadingDataSchema,
  mathDoneDataSchema,
  mathErrorDataSchema
);

export type MathData = Schema.Schema.Type<typeof MathDataSchema>;
export type MathExpression = Schema.Schema.Type<typeof MathExpressionSchema>;
export type MathItem = Schema.Schema.Type<typeof MathItemSchema>;
export type MathOperation = Schema.Schema.Type<typeof MathOperationSchema>;
export type MathRequest = Schema.Schema.Type<typeof MathRequestSchema>;
export type MathResult = Schema.Schema.Type<typeof MathResultSchema>;
export type MathStep = Schema.Schema.Type<typeof MathStepSchema>;
export type MathStepStatus = Schema.Schema.Type<typeof MathStepStatusSchema>;
export type MathStatus = Schema.Schema.Type<typeof MathStatusSchema>;
