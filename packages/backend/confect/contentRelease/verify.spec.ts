import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { progressValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Freezes a complete staged release before any cross-transaction proof read. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "verifyItems",
    args: () => ({
      afterIndex: Schema.Finite,
      releaseId: Schema.String,
    }),
    returns: () => progressValidator,
    error: () => ReleaseErrorWire,
  })
);
