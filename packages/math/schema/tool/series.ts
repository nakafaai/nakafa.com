import {
  boundInputSchema,
  expressionInputSchema,
  pointInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const MathSeriesExpansionInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("series").annotations({
    description: "Compute a series expansion.",
  }),
  order: Schema.optional(
    Schema.NonNegativeInt.annotations({
      description:
        "Taylor polynomial degree. Use 0 only when the user asks for the constant term.",
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
