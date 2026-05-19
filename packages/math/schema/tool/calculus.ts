import {
  boundInputSchema,
  expressionInputSchema,
  pointInputSchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const expressionReservedNames = new Set([
  "Abs",
  "E",
  "I",
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
  "tan",
]);

const symbolPattern = /[A-Za-z_][A-Za-z0-9_]*/gu;

/** Counts free-symbol-looking identifiers while ignoring supported functions. */
function getExpressionSymbols(expression: string) {
  return new Set(
    [...expression.matchAll(symbolPattern)]
      .map(([symbol]) => symbol)
      .filter((symbol) => !expressionReservedNames.has(symbol))
  );
}

/** Requires an explicit calculus variable when parameters make inference unsafe. */
function hasSafeCalculusVariable(value: MathCalculusInput) {
  if (value.variable) {
    return true;
  }

  return getExpressionSymbols(value.expression).size < 2;
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
  })
)
  .pipe(Schema.mutable)
  .annotations({ description: "Calculus tool input." });
