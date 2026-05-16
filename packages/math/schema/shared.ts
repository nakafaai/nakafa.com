import { Schema } from "effect";

export const expressionInputSchema = Schema.NonEmptyString.annotations({
  description:
    "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
});

export const variableInputSchema = Schema.NonEmptyString.annotations({
  description:
    "The variable to use for this operation, for example x, y, or t.",
});

export const boundInputSchema = Schema.NonEmptyString.annotations({
  description:
    "A bound or endpoint for a finite calculation, for example 0, 1, or pi.",
});

export const valueInputSchema = Schema.NonEmptyString.annotations({
  description:
    "A numeric or symbolic value represented as text so exact math is preserved.",
});

export const coordinateInputSchema = valueInputSchema.pipe(
  Schema.pattern(/^[A-Za-z0-9_+\-*/^().\s]+$/, {
    description:
      "A point coordinate written as one math value, for example 1, 4, x, or pi/2.",
  })
);

export const pointInputSchema = Schema.NonEmptyString.annotations({
  description:
    "The point where the operation is evaluated, for example 0, oo, or pi.",
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

export const stringArraySchema = Schema.Array(valueInputSchema).pipe(
  Schema.mutable
);

export const nonEmptyStringArraySchema = Schema.Array(valueInputSchema).pipe(
  Schema.minItems(1),
  Schema.mutable
);

export const pointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.mutable
);

export const twoPointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.itemsCount(2),
  Schema.mutable
);

export const fourPointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.itemsCount(4),
  Schema.mutable
);

const matrixRowSchema = Schema.Array(valueInputSchema).pipe(
  Schema.minItems(1),
  Schema.mutable
);

export const matrixSchema = Schema.Array(matrixRowSchema)
  .pipe(Schema.mutable)
  .pipe(Schema.minItems(1))
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Matrix rows as nested arrays of exact string values, for example [[1, 2], [3, 4]].",
  });

export type MathExpression = Schema.Schema.Type<typeof MathExpressionSchema>;
export type MathItem = Schema.Schema.Type<typeof MathItemSchema>;
export type MathStep = Schema.Schema.Type<typeof MathStepSchema>;
