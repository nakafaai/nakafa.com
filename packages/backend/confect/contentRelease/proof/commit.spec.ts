import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { statusValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "commitProof",
    args: () => ({
      proofJson: Schema.String,
    }),
    returns: () => statusValidator,
    error: () => ReleaseErrorWire,
  })
);
