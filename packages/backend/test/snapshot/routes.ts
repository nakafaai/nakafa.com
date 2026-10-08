import {
  type snapshotBatchReceiptValidator,
  snapshotFamilyValidator,
  type snapshotReceiptValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import { Schema } from "effect";

const SnapshotArgsSchema = Schema.Struct({
  releaseId: Schema.String,
  snapshotJson: Schema.String,
});

const SnapshotBatchArgsSchema = Schema.Struct({
  batchIndex: Schema.Finite,
  family: snapshotFamilyValidator,
  releaseId: Schema.String,
  rowJson: Schema.Array(Schema.String),
  snapshotId: Schema.String,
});

/** Calls the internal snapshot-manifest staging mutation in backend tests. */
export const TEST_STAGE_SNAPSHOT = makeFunctionReference<
  "mutation",
  typeof SnapshotArgsSchema.Type,
  typeof snapshotReceiptValidator.Type
>("contentRelease/snapshot/manifest:stageSnapshot");

/** Calls the internal snapshot-row staging mutation in backend tests. */
export const TEST_STAGE_SNAPSHOT_BATCH = makeFunctionReference<
  "mutation",
  typeof SnapshotBatchArgsSchema.Type,
  typeof snapshotBatchReceiptValidator.Type
>("contentRelease/snapshot/batch:stageSnapshotBatch");
