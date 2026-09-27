import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  currentValidator,
  statusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getStatus",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => statusValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "current",
      args: () => ({}),
      returns: () => currentValidator,
      error: () => ReleaseError,
    })
  );
