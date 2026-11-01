import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * The forecast's monthly test (ADR 0035): each month's first run counts the scores of the sittings before it into one
 * verdict, one page per run, and removes them. It is internal.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      count: Schema.Int,
      cursor: Schema.NullOr(Schema.String),
      errors: Schema.Finite,
      reached: Schema.Int,
    }),
    returns: () => Schema.Null,
  })
);
