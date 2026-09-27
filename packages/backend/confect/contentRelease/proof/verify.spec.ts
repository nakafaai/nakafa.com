import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";
export const artifactProofReceiptValidator = Schema.Struct({
  batchIndex: Schema.Finite,
  verifiedArtifacts: Schema.Finite,
});
export default GroupSpec.makeNode()
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "verifyArtifacts",
      args: () => ({
        batchIndex: Schema.Finite,
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => artifactProofReceiptValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "verifyRelease",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
        verifiedArtifacts: Schema.Finite,
      }),
      returns: () => Schema.Null,
      error: () => ReleaseErrorWire,
    })
  );
