import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  modelBuildRestartArgsValidator,
  modelBuildRestartResultValidator,
  modelBuildStatusValidator,
} from "@repo/backend/confect/contentRelease/models/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "restart",
      args: () => modelBuildRestartArgsValidator.fields,
      returns: () => modelBuildRestartResultValidator,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "status",
      args: () => ({
        releaseId: Schema.String,
      }),
      returns: () => modelBuildStatusValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "resume",
      args: () => ({
        generation: Schema.Finite,
        releaseId: Schema.String,
      }),
      returns: () => Schema.Null,
      error: () => ReleaseErrorWire,
    })
  );
