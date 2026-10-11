import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  stepInputValidator,
  stepResultValidator,
} from "@repo/backend/confect/contents/sections/schema";

/**
 * Builds the section index for the active release, one bounded step at a time.
 * It starts after a release becomes active and can be started by hand, with no
 * arguments, for the release that is active now.
 */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "run",
    args: () => stepInputValidator.fields,
    returns: () => stepResultValidator,
  })
);
