import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Turns a sitting's released results into observations, one page per run (ADR 0035). Releasing the results schedules the
 * first run, and a release happens once, so an answer is observed once. It is internal.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      sittingId: Id("examSittings"),
    }),
    returns: () => Schema.Null,
  })
);
