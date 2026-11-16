import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { PreparedRowSchema } from "@repo/backend/confect/contentRelease/snapshot/shape";
import {
  snapshotBatchReceiptValidator,
  snapshotFamilyValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** The stored manifests one snapshot batch is bound to. */
export const batchContextValidator = Schema.Struct({
  releaseJson: Schema.String,
  snapshotJson: Schema.String,
});

/** One prepared batch and the signed facts the ingress action read for it. */
export const stageBatchArgsValidator = Schema.Struct({
  batchHash: Schema.String,
  batchIndex: Schema.Finite,
  family: snapshotFamilyValidator,
  familyRows: Schema.Finite,
  manifestHash: Schema.String,
  releaseId: Schema.String,
  rows: Schema.mutable(Schema.Array(PreparedRowSchema)),
  snapshotId: Schema.String,
  totalRows: Schema.Finite,
});

/**
 * Stages one snapshot batch in two steps: the ingress action reads its context
 * and prepares every row, then the mutation checks the ledger and inserts.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "context",
      args: () => ({
        family: snapshotFamilyValidator,
        releaseId: Schema.String,
        snapshotId: Schema.String,
      }),
      returns: () => batchContextValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "stageSnapshotBatch",
      args: () => stageBatchArgsValidator.fields,
      returns: () => snapshotBatchReceiptValidator,
      error: () => ReleaseError,
    })
  );
