import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";
/** Request JSON could not satisfy the exact protected runtime contract. */
export class ProtectedRuntimeRequestError extends Schema.TaggedError<ProtectedRuntimeRequestError>()(
  "ProtectedRuntimeRequestError",
  {}
) {}

/** Strictly parses one bounded UTF-8 protected batch request. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "dispatch",
    args: () => ({
      byteLength: Schema.Finite,
      source: Schema.String,
    }),
    returns: () =>
      Schema.Struct({
        body: Schema.String,
        status: Schema.Finite,
      }),
    error: () => ReleaseErrorWire,
  })
);
