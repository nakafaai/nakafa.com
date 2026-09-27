import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { tryoutRuntimeBundleReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "stageTryoutRuntimeBundle",
    args: () => ({
      bundleJson: Schema.String,
      rendererJson: Schema.String,
    }),
    returns: () => tryoutRuntimeBundleReceiptValidator,
    error: () => ReleaseErrorWire,
  })
);
