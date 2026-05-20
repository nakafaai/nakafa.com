import {
  boundInputSchema,
  expressionInputSchema,
  getExpressionSymbols,
  pointInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

/** Requires an explicit calculus variable when parameters make inference unsafe. */
function hasSafeCalculusVariable(value: MathCalculusInput) {
  if (value.variable) {
    return true;
  }

  return getExpressionSymbols(value.expression).size < 2;
}

/** Keeps derivative-order input aligned with the only CAS operation that uses it. */
function hasValidCalculusOrder(value: MathCalculusInput) {
  if (value.order === undefined) {
    return true;
  }

  return value.operation === "differentiate";
}

const MathCalculusStructSchema = Schema.Struct({
  expression: expressionInputSchema,
  lower: Schema.optional(boundInputSchema),
  operation: Schema.Literal("differentiate", "integrate", "limit").annotations({
    description: "Differentiate, integrate, or find a limit.",
  }),
  order: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
      description:
        "Derivative order for differentiate, for example 2 for the second derivative.",
    })
  ),
  point: Schema.optional(pointInputSchema),
  upper: Schema.optional(boundInputSchema),
  variable: Schema.optional(variableInputSchema),
}).annotations({ description: "Calculus tool input." });

type MathCalculusInput = Schema.Schema.Type<typeof MathCalculusStructSchema>;

export const MathCalculusInputSchema = MathCalculusStructSchema.pipe(
  Schema.filter((value) => hasSafeCalculusVariable(value), {
    message: () =>
      "Expected variable when a calculus expression has parameters or more than one symbol.",
  }),
  Schema.filter((value) => hasValidCalculusOrder(value), {
    message: () => "Expected derivative order only for differentiate.",
  })
)
  .pipe(Schema.mutable)
  .annotations({ description: "Calculus tool input." });
