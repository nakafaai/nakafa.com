import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { stageReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Decodes one bounded route batch through the shared wire contract. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "stageRouteBatch",
    args: () => ({
      batchIndex: Schema.Finite,
      releaseId: Schema.String,
      routeJson: Schema.mutable(Schema.Array(Schema.String)),
    }),
    returns: () => stageReceiptValidator,
    error: () => ReleaseErrorWire,
  })
);
