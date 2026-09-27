import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { compactionReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "page",
      args: () => ({}),
      returns: () => compactionReceiptValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "run",
      args: () => ({}),
      returns: () => compactionReceiptValidator,
      error: () => ReleaseErrorWire,
    })
  );
