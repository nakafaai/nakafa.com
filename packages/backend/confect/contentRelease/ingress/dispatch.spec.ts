import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
export const dispatchInputValidator = Schema.Struct({
  byteLength: Schema.Finite,
  source: Schema.String,
});
/** Complete bounded evidence accepted by the Node publication dispatcher. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "dispatch",
    args: () => dispatchInputValidator.fields,
    returns: () =>
      Schema.Struct({
        body: Schema.String,
        status: Schema.Finite,
      }),
  })
);
