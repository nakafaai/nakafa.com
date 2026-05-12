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

const coordinateInputSchema = valueInputSchema.pipe(
  Schema.pattern(/^[A-Za-z0-9_+\-*/^().\s]+$/, {
    description:
      "A point coordinate written as one math value, for example 1, 4, x, or pi/2.",
  })
);

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
    "Whether the verified math evidence includes complete, partial, or unavailable derivation steps.",
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
      "Math step action, for example divide, factor, cancel, or compare.",
  }),
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  primary: MathExpressionSchema,
  relation: Schema.optional(MathExpressionSchema),
  secondary: Schema.optional(MathExpressionSchema),
})
  .pipe(Schema.mutable)
  .annotations({
    description:
      "One deterministic math step emitted for student-facing evidence.",
  });

export const MathPointSchema = Schema.Struct({
  x: coordinateInputSchema,
  y: coordinateInputSchema,
}).pipe(Schema.mutable);

const stringArraySchema = Schema.Array(valueInputSchema).pipe(Schema.mutable);

const nonEmptyStringArraySchema = Schema.Array(valueInputSchema).pipe(
  Schema.minItems(1),
  Schema.mutable
);

const pointArraySchema = Schema.Array(MathPointSchema).pipe(Schema.mutable);

const twoPointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.itemsCount(2),
  Schema.mutable
);

const fourPointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.itemsCount(4),
  Schema.mutable
);

const matrixRowSchema = Schema.Array(valueInputSchema).pipe(
  Schema.minItems(1),
  Schema.mutable
);

const matrixSchema = Schema.Array(matrixRowSchema)
  .pipe(Schema.mutable)
  .pipe(Schema.minItems(1))
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

const MathAlgebraExpressionInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal(
    "apart",
    "cancel",
    "domain",
    "expand",
    "factor",
    "rationalize",
    "simplify",
    "together"
  ).annotations({
    description: "Choose the algebra operation for the provided expression.",
  }),
  variable: Schema.optional(variableInputSchema),
}).pipe(Schema.mutable);

const MathAlgebraCompareInputSchema = Schema.Struct({
  left: expressionInputSchema,
  operation: Schema.Literal("compare").annotations({
    description: "Compare the left and right expressions for equivalence.",
  }),
  right: expressionInputSchema,
  variable: Schema.optional(variableInputSchema),
}).pipe(Schema.mutable);

export const MathAlgebraInputSchema = Schema.Union(
  MathAlgebraExpressionInputSchema,
  MathAlgebraCompareInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Symbolic algebra tool input. Use expression for all algebra operations except compare; use left and right for compare.",
  });

const MathEquationSingleInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("roots", "solve").annotations({
    description: "Solve one equation, inequality, or polynomial expression.",
  }),
  variable: Schema.optional(variableInputSchema),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
}).pipe(Schema.mutable);

const MathEquationSystemInputSchema = Schema.Struct({
  expressions: nonEmptyStringArraySchema.annotations({
    description: "Equations or inequalities for systems.",
  }),
  operation: Schema.Literal("solve").annotations({
    description: "Solve a system of equations or inequalities.",
  }),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
}).pipe(Schema.mutable);

export const MathEquationInputSchema = Schema.Union(
  MathEquationSingleInputSchema,
  MathEquationSystemInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Equation solving tool input. Use expression for one equation or expressions for a system.",
  });

const MathGeometryPointsInputSchema = Schema.Struct({
  operation: Schema.Literal(
    "circle",
    "distance",
    "line",
    "midpoint",
    "slope"
  ).annotations({
    description:
      "Choose a point-based coordinate geometry operation. Use exactly two points.",
  }),
  points: twoPointArraySchema.annotations({
    description:
      "Exactly two coordinate points, for example [{ x: '1', y: '2' }, { x: '4', y: '6' }].",
  }),
}).pipe(Schema.mutable);

const MathGeometryIntersectionExpressionsInputSchema = Schema.Struct({
  expressions: Schema.Array(valueInputSchema)
    .pipe(Schema.minItems(2), Schema.mutable)
    .annotations({
      description:
        "At least two equations whose intersections should be found.",
    }),
  operation: Schema.Literal("intersection").annotations({
    description: "Find intersections from equations.",
  }),
}).pipe(Schema.mutable);

const MathGeometryIntersectionPointsInputSchema = Schema.Struct({
  operation: Schema.Literal("intersection").annotations({
    description: "Find intersections from point-defined lines.",
  }),
  points: fourPointArraySchema.annotations({
    description:
      "Exactly four points defining two lines, where points 1-2 form the first line and points 3-4 form the second.",
  }),
}).pipe(Schema.mutable);

export const MathGeometryInputSchema = Schema.Union(
  MathGeometryPointsInputSchema,
  MathGeometryIntersectionExpressionsInputSchema,
  MathGeometryIntersectionPointsInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Coordinate geometry tool input. Use points for point-based geometry and expressions for equation intersections.",
  });

const MathDiscreteValuesInputSchema = Schema.Struct({
  operation: Schema.Literal("gcd", "lcm").annotations({
    description: "Compute a result from a list of integers.",
  }),
  values: nonEmptyStringArraySchema.annotations({
    description: "Integer values, for example [84, 30].",
  }),
}).pipe(Schema.mutable);

const MathDiscreteIntegerInputSchema = Schema.Struct({
  n: valueInputSchema,
  operation: Schema.Literal("is_prime", "prime_factorization").annotations({
    description: "Inspect one integer.",
  }),
}).pipe(Schema.mutable);

const MathDiscreteModularInputSchema = Schema.Struct({
  modulus: valueInputSchema,
  n: valueInputSchema,
  operation: Schema.Literal("modular").annotations({
    description: "Compute n modulo modulus.",
  }),
}).pipe(Schema.mutable);

const MathDiscreteCountInputSchema = Schema.Struct({
  k: valueInputSchema,
  n: valueInputSchema,
  operation: Schema.Literal("combination", "permutation").annotations({
    description: "Compute combinations or permutations from n and k.",
  }),
}).pipe(Schema.mutable);

export const MathDiscreteInputSchema = Schema.Union(
  MathDiscreteValuesInputSchema,
  MathDiscreteIntegerInputSchema,
  MathDiscreteModularInputSchema,
  MathDiscreteCountInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Discrete math and number theory tool input. Required fields depend on the selected operation.",
  });

const MathMatrixUnaryInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal(
    "determinant",
    "eigenvalues",
    "eigenvectors",
    "inverse",
    "rank",
    "rref"
  ).annotations({
    description: "Choose the linear algebra operation for one matrix.",
  }),
}).pipe(Schema.mutable);

const MathMatrixMultiplyInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal("matrix_multiply").annotations({
    description: "Multiply two matrices.",
  }),
  right_matrix: matrixSchema,
}).pipe(Schema.mutable);

const MathLinearSystemInputSchema = Schema.Struct({
  matrix: matrixSchema,
  operation: Schema.Literal("linear_system").annotations({
    description: "Solve a linear system from coefficient matrix and vector.",
  }),
  vector: nonEmptyStringArraySchema.annotations({
    description: "Right-hand side vector for a linear system.",
  }),
}).pipe(Schema.mutable);

export const MathMatrixInputSchema = Schema.Union(
  MathMatrixUnaryInputSchema,
  MathMatrixMultiplyInputSchema,
  MathLinearSystemInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Linear algebra tool input. Matrix multiplication requires right_matrix; linear systems require vector.",
  });

const MathSeriesExpansionInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("series").annotations({
    description: "Compute a series expansion.",
  }),
  order: Schema.optional(
    Schema.Number.annotations({
      description: "Series expansion order.",
    })
  ),
  point: Schema.optional(pointInputSchema),
  variable: Schema.optional(variableInputSchema),
}).pipe(Schema.mutable);

const MathSeriesRangeInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  lower: boundInputSchema,
  operation: Schema.Literal("product", "summation").annotations({
    description: "Compute a finite or symbolic range operation.",
  }),
  upper: boundInputSchema,
  variable: Schema.optional(variableInputSchema),
}).pipe(Schema.mutable);

export const MathSeriesInputSchema = Schema.Union(
  MathSeriesExpansionInputSchema,
  MathSeriesRangeInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Series, summation, and product tool input. Summation and product require lower and upper bounds.",
  });

const MathStatisticsDatasetInputSchema = Schema.Struct({
  operation: Schema.Literal(
    "mean",
    "median",
    "mode",
    "quartiles",
    "standard_deviation",
    "variance"
  ).annotations({
    description: "Choose the descriptive statistics operation.",
  }),
  values: nonEmptyStringArraySchema.annotations({
    description: "Dataset values as exact strings.",
  }),
}).pipe(Schema.mutable);

const MathZScoreInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("z_score").annotations({
    description: "Compute a z-score for one target value in a dataset.",
  }),
  values: nonEmptyStringArraySchema.annotations({
    description: "Dataset values as exact strings.",
  }),
}).pipe(Schema.mutable);

export const MathStatisticsInputSchema = Schema.Union(
  MathStatisticsDatasetInputSchema,
  MathZScoreInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Statistics tool input. z_score requires both a target expression and dataset values.",
  });

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

export const MathToolInputSchema = Schema.Union(
  MathArithmeticInputSchema,
  MathAlgebraInputSchema,
  MathEquationInputSchema,
  MathGeometryInputSchema,
  MathDiscreteInputSchema,
  MathMatrixInputSchema,
  MathSeriesInputSchema,
  MathStatisticsInputSchema,
  MathProbabilityInputSchema,
  MathCalculusInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Strict math tool input shape accepted before deterministic math evidence is requested.",
  });

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
export type MathToolInput = Schema.Schema.Type<typeof MathToolInputSchema>;
