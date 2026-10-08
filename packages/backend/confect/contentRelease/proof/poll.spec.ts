import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  proofPollValidator,
  proofStatusValidator,
} from "@repo/backend/confect/contentRelease/proof/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "poll",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => proofPollValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "status",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => proofStatusValidator,
      error: () => ReleaseError,
    })
  );
