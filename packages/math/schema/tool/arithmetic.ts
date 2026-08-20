import { expressionInputSchema } from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";
export const MathArithmeticInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  operation: Schema.Literal("evaluate").annotate({
    description: "Evaluate an exact arithmetic or numeric expression.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Exact arithmetic tool input." });
