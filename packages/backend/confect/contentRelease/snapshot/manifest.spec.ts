import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { snapshotReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "stageSnapshot",
    args: () => ({
      releaseId: Schema.String,
      snapshotJson: Schema.String,
    }),
    returns: () => snapshotReceiptValidator,
    error: () => ReleaseError,
  })
);
