import {
  expressionInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const MathAlgebraExpressionInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literals([
    "apart",
    "cancel",
    "domain",
    "expand",
    "factor",
    "rationalize",
    "simplify",
    "together",
  ]).annotate({
    description: "Choose the algebra operation for the provided expression.",
  }),
  variable: Schema.optionalKey(variableInputSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathAlgebraCompareInputSchema = Schema.Struct({
  left: expressionInputSchema,
  operation: Schema.Literal("compare").annotate({
    description: "Compare the left and right expressions for equivalence.",
  }),
  right: expressionInputSchema,
  variable: Schema.optionalKey(variableInputSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const MathAlgebraInputSchema = Schema.Union([
  MathAlgebraExpressionInputSchema,
  MathAlgebraCompareInputSchema,
]).annotate({
  description:
    "Symbolic algebra tool input. Use expression for all algebra operations except compare; use left and right for compare.",
});
