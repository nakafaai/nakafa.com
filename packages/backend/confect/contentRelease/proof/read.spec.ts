import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";
export const proofRowValidator = Schema.Struct({
  index: Schema.Finite,
  itemJson: Schema.String,
  projectionJson: Schema.optionalKey(Schema.String),
  rollbackJson: Schema.String,
});
export const proofPageValidator = Schema.Struct({
  done: Schema.Boolean,
  nextIndex: Schema.Finite,
  rows: Schema.mutable(Schema.Array(proofRowValidator)),
});
export const proofStateValidator = Schema.Struct({
  checkedIndex: Schema.Finite,
  releaseJson: Schema.String,
  rendererJson: Schema.String,
  role: Schema.Literals(["candidate", "recovery"]),
  stagedArtifacts: Schema.Finite,
  stagedDeletes: Schema.Finite,
  stagedItems: Schema.Finite,
  stagedProjections: Schema.Finite,
  stagedRoutes: Schema.Finite,
  stagedSnapshotBatches: Schema.Finite,
  stagedSnapshotRows: Schema.Finite,
  stagedUpserts: Schema.Finite,
  status: Schema.Literals(["verifying", "verified"]),
});
export const artifactProofRowValidator = Schema.Struct({
  artifactJson: Schema.String,
  index: Schema.Finite,
  itemJson: Schema.String,
});
export const artifactProofPageValidator = Schema.Struct({
  batchIndex: Schema.Finite,
  rows: Schema.mutable(Schema.Array(artifactProofRowValidator)),
});
export const artifactProofPlanValidator = Schema.Struct({
  batchCount: Schema.Finite,
  stagedArtifacts: Schema.Finite,
});
export const routePageValidator = Schema.Struct({
  done: Schema.Boolean,
  nextIndex: Schema.Finite,
  rows: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        index: Schema.Finite,
        routeJson: Schema.String,
      })
    )
  ),
});
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "state",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => proofStateValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "artifactPlan",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => artifactProofPlanValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "artifactBatch",
      args: () => ({
        batchIndex: Schema.Finite,
        releaseId: Schema.String,
      }),
      returns: () => artifactProofPageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "page",
      args: () => ({
        afterIndex: Schema.Finite,
        releaseId: Schema.String,
      }),
      returns: () => proofPageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "routePage",
      args: () => ({
        afterIndex: Schema.Finite,
        releaseId: Schema.String,
      }),
      returns: () => routePageValidator,
      error: () => ReleaseError,
    })
  );
