import { expressionInputSchema } from "@repo/math/schema/shared";
import { Schema } from "effect";

export const MathArithmeticInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("evaluate").annotations({
    description: "Evaluate an exact arithmetic or numeric expression.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Exact arithmetic tool input." });
