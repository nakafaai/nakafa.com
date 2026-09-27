import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { proofPollValidator } from "@repo/backend/confect/contentRelease/proof/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "poll",
    args: () => ({
      manifestHash: Schema.String,
      releaseId: Schema.String,
    }),
    returns: () => proofPollValidator,
    error: () => ReleaseError,
  })
);
