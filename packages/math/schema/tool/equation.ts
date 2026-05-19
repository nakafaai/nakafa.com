import {
  boundInputSchema,
  expressionInputSchema,
  nonEmptyStringArraySchema,
  stringArraySchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const equationDomainFields = {
  lower: Schema.optional(
    boundInputSchema.annotations({
      description:
        "Optional lower endpoint for the solve domain, for example 0 when the user says x > 0.",
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
        "Optional upper endpoint for the solve domain, for example 1 when the user says x < 1.",
    })
  ),
  upperInclusive: Schema.optional(
    Schema.Boolean.annotations({
      description:
        "Whether the upper endpoint is included. Use false for strict upper bounds such as x < 1.",
    })
  ),
};

const MathEquationSingleInputSchema = Schema.Struct({
  expression: expressionInputSchema,
  ...equationDomainFields,
  operation: Schema.Literal("roots", "solve").annotations({
    description: "Solve one equation, inequality, or polynomial expression.",
  }),
  variable: Schema.optional(variableInputSchema),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
}).pipe(Schema.mutable);

const MathEquationSystemInputSchema = Schema.Struct({
  expressions: nonEmptyStringArraySchema.annotations({
    description: "Equations or inequalities for systems.",
  }),
  ...equationDomainFields,
  operation: Schema.Literal("solve").annotations({
    description: "Solve a system of equations or inequalities.",
  }),
  variables: Schema.optional(
    stringArraySchema.annotations({
      description: "Variables to solve for, for example [x, y].",
    })
  ),
}).pipe(Schema.mutable);

export const MathEquationInputSchema = Schema.Union(
  MathEquationSingleInputSchema,
  MathEquationSystemInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Equation solving tool input. Use expression for one equation or expressions for a system. Include solve-domain bounds when the user gives restrictions such as x > 0.",
  });
