import { Array as Arr, HashSet, pipe, Schema, Struct } from "effect";

const expressionReservedNames = HashSet.make(
  "Abs",
  "E",
  "I",
  "Rational",
  "acos",
  "asin",
  "atan",
  "cos",
  "e",
  "exp",
  "factorial",
  "factorial2",
  "ln",
  "log",
  "oo",
  "pi",
  "sin",
  "sqrt",
  "tan"
);
const symbolPattern = /[A-Za-z_][A-Za-z0-9_]*/gu;
/** Builds a non-empty string with model-facing metadata on its base schema. */
export function describedNonEmptyString(description: string) {
  return Schema.String.annotate({ description }).pipe(
    Schema.check(Schema.isMinLength(1))
  );
}
/** Returns variable-looking identifiers while ignoring supported functions. */
export function getExpressionSymbols(expression: string) {
  return pipe(
    [...expression.matchAll(symbolPattern)],
    Arr.map(([symbol]) => symbol),
    Arr.filter((symbol) => !HashSet.has(expressionReservedNames, symbol)),
    Arr.dedupe
  );
}
export const expressionInputSchema = describedNonEmptyString(
  "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3)."
);
export const variableInputSchema = describedNonEmptyString(
  "The variable to use for this operation, for example x, y, or t. Required when the expression has parameters or more than one symbol."
);
export const boundInputSchema = describedNonEmptyString(
  "A bound or endpoint for a finite calculation, for example 0, 1, or pi."
);
export const valueInputSchema = describedNonEmptyString(
  "A numeric or symbolic value represented as text so exact math is preserved."
);
const coordinateInputSchema = valueInputSchema.pipe(
  Schema.check(
    Schema.isPattern(/^[A-Za-z0-9_+\-*/^().\s]+$/u, {
      description:
        "A point coordinate written as one math value, for example 1, 4, x, or pi/2.",
    })
  )
);
export const pointInputSchema = describedNonEmptyString(
  "The point where the operation is evaluated, for example 0, oo, or pi."
);
export const MathExpressionSchema = Schema.Struct({
  expression: expressionInputSchema,
  latex: Schema.String.annotate({
    description: "LaTeX representation of the expression for rendering.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description:
      "A math expression paired with LaTeX for deterministic evidence rendering.",
  });
export const MathItemSchema = Schema.Struct({
  label: Schema.String.annotate({
    description: "Short student-facing label for the math item.",
  }),
  latex: Schema.optionalKey(
    Schema.String.annotate({
      description: "Optional LaTeX representation for display.",
    })
  ),
  value: valueInputSchema,
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: "One labeled value emitted by a deterministic math result.",
  });
export const MathStepSchema = Schema.Struct({
  action: describedNonEmptyString(
    "Math step action, for example divide, factor, cancel, or compare."
  ),
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  primary: MathExpressionSchema,
  relation: Schema.optionalKey(MathExpressionSchema),
  secondary: Schema.optionalKey(MathExpressionSchema),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description:
      "One deterministic math step emitted for student-facing evidence.",
  });
const MathPointSchema = Schema.Struct({
  x: coordinateInputSchema,
  y: coordinateInputSchema,
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: "A two-dimensional coordinate point.",
  });
export const stringArraySchema = Schema.Array(valueInputSchema).pipe(
  Schema.mutable,
  Schema.annotate({
    description: "Array of exact string values.",
  })
);
export const nonEmptyStringArraySchema = Schema.Array(valueInputSchema).pipe(
  Schema.mutable,
  Schema.check(Schema.isMinLength(1))
);
export const pointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.mutable,
  Schema.annotate({
    description: "Array of coordinate points.",
  })
);
export const twoPointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.mutable,
  Schema.check(Schema.isBetweenLength(2, 2))
);
export const fourPointArraySchema = Schema.Array(MathPointSchema).pipe(
  Schema.mutable,
  Schema.check(Schema.isBetweenLength(4, 4))
);
const matrixRowSchema = Schema.Array(valueInputSchema).pipe(
  Schema.mutable,
  Schema.check(Schema.isMinLength(1))
);
export const matrixSchema = Schema.Array(matrixRowSchema)
  .pipe(Schema.mutable, Schema.check(Schema.isMinLength(1)))
  .annotate({
    description:
      "Matrix rows as nested arrays of exact string values, for example [[1, 2], [3, 4]].",
  });
export type MathExpression = typeof MathExpressionSchema.Type;
export type MathItem = typeof MathItemSchema.Type;
export type MathStep = typeof MathStepSchema.Type;
