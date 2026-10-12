import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * Whether the section index may answer a search now: the last build that
 * finished indexed the active release with the model that embeds the
 * questions. A search asks this first, so that a question is not embedded and
 * searched for while the index cannot answer it.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "ready",
    args: () => ({}),
    returns: () => Schema.Boolean,
  })
);
