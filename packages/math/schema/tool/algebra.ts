import {
  expressionInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

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
