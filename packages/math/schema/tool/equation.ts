import {
  boundInputSchema,
  expressionInputSchema,
  getExpressionSymbols,
  nonEmptyStringArraySchema,
  stringArraySchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const equationDomainFields = {
  lower: Schema.optionalKey(
    boundInputSchema.annotate({
      description:
        "Optional lower endpoint for the solve domain, for example 0 when the user says x > 0. System inputs with lower or upper must also set variable to the bounded variable.",
    })
  ),
  lowerInclusive: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "Whether the lower endpoint is included. Use false for strict lower bounds such as x > 0.",
    })
  ),
  upper: Schema.optionalKey(
    boundInputSchema.annotate({
      description:
        "Optional upper endpoint for the solve domain, for example 1 when the user says x < 1. System inputs with lower or upper must also set variable to the bounded variable.",
    })
  ),
  upperInclusive: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "Whether the upper endpoint is included. Use false for strict upper bounds such as x < 1.",
    })
  ),
};
const unsupportedRootDomainFields = {
  lower: Schema.optionalKey(Schema.Never),
  lowerInclusive: Schema.optionalKey(Schema.Never),
  upper: Schema.optionalKey(Schema.Never),
  upperInclusive: Schema.optionalKey(Schema.Never),
};
const MathEquationRootInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  ...unsupportedRootDomainFields,
  operation: Schema.Literal("roots").annotate({
    description: "Find exact polynomial roots without solve-domain bounds.",
  }),
  variable: Schema.optionalKey(variableInputSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathEquationSingleSolveInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  ...equationDomainFields,
  operation: Schema.Literal("solve").annotate({
    description: "Solve one equation, inequality, or polynomial expression.",
  }),
  variable: Schema.optionalKey(variableInputSchema),
  variables: Schema.optionalKey(
    stringArraySchema.annotate({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathEquationSystemStructSchema = Schema.Struct({
  expressions: nonEmptyStringArraySchema.annotate({
    description: "Equations or inequalities for systems.",
  }),
  ...equationDomainFields,
  operation: Schema.Literal("solve").annotate({
    description: "Solve a system of equations or inequalities.",
  }),
  variable: Schema.optionalKey(
    variableInputSchema.annotate({
      description:
        "Bounded variable for system solve-domain restrictions such as x > 0.",
    })
  ),
  variables: Schema.optionalKey(
    stringArraySchema.annotate({
      description:
        "Variables to solve for, for example [x, y]. Include unknowns that need solved; keep symbolic parameters out.",
    })
  ),
});
type MathEquationSystemInput = Schema.Schema.Type<
  typeof MathEquationSystemStructSchema
>;
/** Returns whether a solve request includes a non-real solve domain. */
function hasSolveDomain(value: MathEquationSystemInput) {
  return value.lower !== undefined || value.upper !== undefined;
}
/** Requires bounded systems to declare the constrained variable. */
function hasBoundedDomainVariable(value: MathEquationSystemInput) {
  if (!hasSolveDomain(value)) {
    return true;
  }
  if (!(value.variable && value.variables)) {
    return false;
  }
  const variables = new Set(value.variables);
  if (!variables.has(value.variable)) {
    return false;
  }
  return true;
}
/** Requires every bounded-system equation to involve a selected unknown. */
function hasSolvedVariableInEveryBoundedExpression(
  value: MathEquationSystemInput
) {
  if (!(hasSolveDomain(value) && value.variables)) {
    return true;
  }
  const variables = new Set(value.variables);
  return value.expressions.every((expression) =>
    [...getExpressionSymbols(expression)].some((symbol) =>
      variables.has(symbol)
    )
  );
}
const MathEquationSystemInputSchema = MathEquationSystemStructSchema.mapFields(
  Struct.map(Schema.mutableKey),
  { unsafePreserveChecks: true }
)
  .check(
    Schema.makeFilter((value) => hasBoundedDomainVariable(value), {
      message:
        "Expected bounded system solves to include the bounded variable in variables.",
    })
  )
  .check(
    Schema.makeFilter(
      (value) => hasSolvedVariableInEveryBoundedExpression(value),
      {
        message:
          "Expected every bounded-system expression to include a solved variable.",
      }
    )
  );
export const MathEquationInputSchema = Schema.Union([
  MathEquationRootInputSchema,
  MathEquationSingleSolveInputSchema,
  MathEquationSystemInputSchema,
]).annotate({
  description:
    "Equation solving tool input. Use roots for unrestricted polynomial roots, solve for equations or inequalities, and expressions for systems. Include solve-domain bounds only for solve operations. For bounded systems, include the bounded variable in variables and list unknowns that should be solved.",
});
