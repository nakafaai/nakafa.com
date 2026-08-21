import {
  boundInputSchema,
  expressionInputSchema,
  getExpressionSymbols,
  pointInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

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
  lower: Schema.optionalKey(boundInputSchema),
  operation: Schema.Literals(["differentiate", "integrate", "limit"]).annotate({
    description: "Differentiate, integrate, or find a limit.",
  }),
  order: Schema.optionalKey(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ).annotate({
      description:
        "Derivative order for differentiate, for example 2 for the second derivative.",
    })
  ),
  point: Schema.optionalKey(pointInputSchema),
  upper: Schema.optionalKey(boundInputSchema),
  variable: Schema.optionalKey(variableInputSchema),
}).annotate({ description: "Calculus tool input." });
type MathCalculusInput = Schema.Schema.Type<typeof MathCalculusStructSchema>;
export const MathCalculusInputSchema = MathCalculusStructSchema.mapFields(
  Struct.map(Schema.mutableKey)
)
  .check(
    Schema.makeFilter((value) => hasSafeCalculusVariable(value), {
      message:
        "Expected variable when a calculus expression has parameters or more than one symbol.",
    })
  )
  .check(
    Schema.makeFilter((value) => hasValidCalculusOrder(value), {
      message: "Expected derivative order only for differentiate.",
    })
  )
  .annotate({ description: "Calculus tool input." });
