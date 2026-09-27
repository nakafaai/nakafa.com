import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { cleanupReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Validates server-owned cleanup counters before advancing a page. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "cleanup",
    args: () => ({
      releaseId: Schema.String,
    }),
    returns: () => cleanupReceiptValidator,
    error: () => ReleaseError,
  })
);
