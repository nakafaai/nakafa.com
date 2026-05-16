import {
  boundInputSchema,
  expressionInputSchema,
  pointInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

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
