import type { stageBatchArgsValidator } from "@repo/backend/confect/contentRelease/snapshot/batch.spec";
import type {
  snapshotBatchReceiptValidator,
  snapshotReceiptValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import { Schema } from "effect";

const SnapshotArgsSchema = Schema.Struct({
  releaseId: Schema.String,
  snapshotJson: Schema.String,
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
  typeof stageBatchArgsValidator.Type,
  typeof snapshotBatchReceiptValidator.Type
>("contentRelease/snapshot/batch:stageSnapshotBatch");
