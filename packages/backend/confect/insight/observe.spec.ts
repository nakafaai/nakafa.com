import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Turns a sitting's released results into observations, a few students per run, and tests the forecast against them
 * (ADR 0035). Releasing the results schedules the first run, and a release happens once, so an answer is observed
 * once. It is internal.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      after: Schema.NullOr(Id("tenantPeople")),
      sittingId: Id("examSittings"),
    }),
    returns: () => Schema.Null,
  })
);
