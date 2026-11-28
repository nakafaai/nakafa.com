import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { familySnapshotProofValidator } from "@repo/backend/confect/contentRelease/proof/spec";
import { snapshotFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

const artifactProofReceiptValidator = Schema.Struct({
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
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "verifySnapshots",
      args: () => ({
        family: snapshotFamilyValidator,
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => Schema.NullOr(familySnapshotProofValidator),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "verifyRelease",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
        snapshotProofs: Schema.mutable(
          Schema.Array(familySnapshotProofValidator)
        ),
        verifiedArtifacts: Schema.Finite,
      }),
      returns: () => Schema.Null,
      error: () => ReleaseError,
    })
  );
