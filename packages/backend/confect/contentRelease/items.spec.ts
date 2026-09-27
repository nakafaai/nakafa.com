import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { stageReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Decodes one bounded item batch through the shared wire contract. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "stageItemBatch",
      args: () => ({
        batchIndex: Schema.Finite,
        itemJson: Schema.mutable(Schema.Array(Schema.String)),
        releaseId: Schema.String,
      }),
      returns: () => stageReceiptValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "stageProjectionBatch",
      args: () => ({
        batchIndex: Schema.Finite,
        projectionJson: Schema.mutable(Schema.Array(Schema.String)),
        releaseId: Schema.String,
      }),
      returns: () => stageReceiptValidator,
      error: () => ReleaseError,
    })
  );
