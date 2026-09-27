import { Table } from "@confect/core";
import type { WorkflowId } from "@convex-dev/workflow";
import { proofFailureValidator } from "@repo/backend/confect/contentRelease/proof/spec";
import { releaseProgress } from "@repo/backend/confect/contentRelease/schema";
import {
  contentFamilyValidator,
  releaseRoleValidator,
  releaseSnapshotTransitionsValidator,
  releaseStatusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    abortedAt: Schema.optionalKey(Schema.Finite),
    abortedRows: Schema.optionalKey(Schema.Finite),
    abortingAt: Schema.optionalKey(Schema.Finite),
    baseManifestHash: Schema.Union([Schema.String, Schema.Null]),
    baseReleaseId: Schema.Union([Schema.String, Schema.Null]),
    baseFamilies: Schema.mutable(Schema.Array(contentFamilyValidator)),
    cleanupAt: Schema.optionalKey(Schema.Finite),
    cleanupDeletedArtifacts: Schema.optionalKey(Schema.Finite),
    cleanupFutureAt: Schema.optionalKey(Schema.Finite),
    cleanupHash: Schema.optionalKey(Schema.String),
    cleanupRetryAt: Schema.optionalKey(Schema.Finite),
    completedAt: Schema.optionalKey(Schema.Finite),
    createdAt: Schema.Finite,
    manifestHash: Schema.String,
    originKind: Schema.Union([
      Schema.Literal("git"),
      Schema.Literal("rollback"),
    ]),
    proofAt: Schema.optionalKey(Schema.Finite),
    proofFailure: Schema.optionalKey(proofFailureValidator),
    proofJson: Schema.optionalKey(Schema.String),
    proofWorkflowId: Schema.optionalKey(
      Schema.Opaque<WorkflowId>()(Schema.String)
    ),
    receiptJson: Schema.optionalKey(Schema.String),
    releaseId: Schema.String,
    releaseJson: Schema.String,
    rendererJson: Schema.String,
    rendererManifestHash: Schema.String,
    resultFamilies: Schema.mutable(Schema.Array(contentFamilyValidator)),
    role: releaseRoleValidator,
    sequence: Schema.Finite,
    snapshotTransitions: releaseSnapshotTransitionsValidator,
    status: releaseStatusValidator,
    tryoutRuntimeBundleHash: Schema.optionalKey(Schema.String),
    tryoutRuntimeRequired: Schema.optionalKey(Schema.Literal(true)),
    updatedAt: Schema.Finite,
    verifiedAt: Schema.optionalKey(Schema.Finite),
    ...releaseProgress,
  })
)
  .index("by_releaseId", ["releaseId"])
  .index("by_sequence", ["sequence"])
  .index("by_status_and_sequence", ["status", "sequence"]);
