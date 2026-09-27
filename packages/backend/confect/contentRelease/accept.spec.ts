import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { abortReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Builds the cumulative terminal receipt retained by an aborted recovery. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "accept",
    args: () => ({
      recoveryId: Schema.String,
      releaseId: Schema.String,
    }),
    returns: () => abortReceiptValidator,
    error: () => ReleaseError,
  })
);
