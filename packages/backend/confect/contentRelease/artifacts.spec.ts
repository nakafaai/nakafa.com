import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { stageReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Stages one bounded artifact batch from the header of each authenticated artifact. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "stageArtifactBatch",
    args: () => ({
      artifactJson: Schema.mutable(Schema.Array(Schema.String)),
      batchIndex: Schema.Finite,
      releaseId: Schema.String,
    }),
    returns: () => stageReceiptValidator,
    error: () => ReleaseError,
  })
);
