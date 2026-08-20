import {
  boundInputSchema,
  expressionInputSchema,
  pointInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const MathSeriesExpansionInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("series").annotate({
    description: "Compute a series expansion.",
  }),
  order: Schema.optionalKey(
    Schema.Finite.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(0))
      .annotate({
        description:
          "Taylor polynomial degree. Use 0 only when the user asks for the constant term.",
      })
  ),
  point: Schema.optionalKey(pointInputSchema),
  variable: Schema.optionalKey(variableInputSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathSeriesRangeInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  lower: boundInputSchema,
  operation: Schema.Literals(["product", "summation"]).annotate({
    description: "Compute a finite or symbolic range operation.",
  }),
  upper: boundInputSchema,
  variable: Schema.optionalKey(variableInputSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const MathSeriesInputSchema = Schema.Union([
  MathSeriesExpansionInputSchema,
  MathSeriesRangeInputSchema,
]).annotate({
  description:
    "Series, summation, and product tool input. Summation and product require lower and upper bounds.",
});
