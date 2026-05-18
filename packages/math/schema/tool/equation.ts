import {
  expressionInputSchema,
  nonEmptyStringArraySchema,
  stringArraySchema,
  variableInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const MathEquationSingleInputSchema = Schema.Struct({
  expression: expressionInputSchema,
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
      "Equation solving tool input. Use expression for one equation or expressions for a system.",
  });
