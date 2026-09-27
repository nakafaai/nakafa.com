import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  abortReceiptValidator,
  statusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "stageRelease",
      args: () => ({
        releaseJson: Schema.String,
        rendererJson: Schema.String,
      }),
      returns: () => statusValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "stageRecovery",
      args: () => ({
        releaseJson: Schema.String,
        rendererJson: Schema.String,
      }),
      returns: () => statusValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "abort",
      args: () => ({
        releaseId: Schema.String,
      }),
      returns: () => abortReceiptValidator,
      error: () => ReleaseErrorWire,
    })
  );
