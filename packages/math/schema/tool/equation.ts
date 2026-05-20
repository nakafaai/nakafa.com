import {
  boundInputSchema,
  expressionInputSchema,
  getExpressionSymbols,
  nonEmptyStringArraySchema,
  stringArraySchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const equationDomainFields = {
  lower: Schema.optional(
    boundInputSchema.annotations({
      description:
        "Optional lower endpoint for the solve domain, for example 0 when the user says x > 0. System inputs with lower or upper must also set variable to the bounded variable.",
    })
  ),
  lowerInclusive: Schema.optional(
    Schema.Boolean.annotations({
      description:
        "Whether the lower endpoint is included. Use false for strict lower bounds such as x > 0.",
    })
  ),
  upper: Schema.optional(
    boundInputSchema.annotations({
      description:
        "Optional upper endpoint for the solve domain, for example 1 when the user says x < 1. System inputs with lower or upper must also set variable to the bounded variable.",
    })
  ),
  upperInclusive: Schema.optional(
    Schema.Boolean.annotations({
      description:
        "Whether the upper endpoint is included. Use false for strict upper bounds such as x < 1.",
    })
  ),
};

const unsupportedRootDomainFields = {
  lower: Schema.optional(Schema.Never),
  lowerInclusive: Schema.optional(Schema.Never),
  upper: Schema.optional(Schema.Never),
  upperInclusive: Schema.optional(Schema.Never),
};

const MathEquationRootInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  ...unsupportedRootDomainFields,
  operation: Schema.Literal("roots").annotations({
    description: "Find exact polynomial roots without solve-domain bounds.",
  }),
  variable: Schema.optional(variableInputSchema),
}).pipe(Schema.mutable);

const MathEquationSingleSolveInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  ...equationDomainFields,
  operation: Schema.Literal("solve").annotations({
    description: "Solve one equation, inequality, or polynomial expression.",
  }),
  variable: Schema.optional(variableInputSchema),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
}).pipe(Schema.mutable);

const MathEquationSystemStructSchema = Schema.Struct({
  expressions: nonEmptyStringArraySchema.annotations({
    description: "Equations or inequalities for systems.",
  }),
  ...equationDomainFields,
  operation: Schema.Literal("solve").annotations({
    description: "Solve a system of equations or inequalities.",
  }),
  variable: Schema.optional(
    variableInputSchema.annotations({
      description:
        "Bounded variable for system solve-domain restrictions such as x > 0.",
    })
  ),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description:
        "Variables to solve for, for example [x, y]. Bounded systems must include every variable used by the system.",
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

/** Requires bounded systems to solve every symbol mentioned by the system. */
function hasCompleteBoundedSystemVariables(value: MathEquationSystemInput) {
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

  return value.expressions.every((expression) =>
    [...getExpressionSymbols(expression)].every((symbol) =>
      variables.has(symbol)
    )
  );
}

const MathEquationSystemInputSchema = MathEquationSystemStructSchema.pipe(
  Schema.filter((value) => hasCompleteBoundedSystemVariables(value), {
    message: () =>
      "Expected bounded system solves to include all solved variables and the bounded variable.",
  })
).pipe(Schema.mutable);

export const MathEquationInputSchema = Schema.Union(
  MathEquationRootInputSchema,
  MathEquationSingleSolveInputSchema,
  MathEquationSystemInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Equation solving tool input. Use roots for unrestricted polynomial roots, solve for equations or inequalities, and expressions for systems. Include solve-domain bounds only for solve operations. For bounded systems, include variable and every solved variable.",
  });
