import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What the generation marking did: recorded the retired generation, found one already recorded, or found no active release. */
export const markRetiredGenerationResult = Schema.Struct({
  outcome: Schema.Literals(["marked", "alreadyRecorded", "noActiveRelease"]),
});

/**
 * The one-time record of the active release's content generation, which the
 * bootstrap of the first 1.0.0 release depends on. The operator runs it on dev
 * and prod before that release is staged, and it is removed with its tests once
 * both deployments are verified.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "markRetiredGeneration",
    args: () => ({}),
    returns: () => markRetiredGenerationResult,
  })
);
