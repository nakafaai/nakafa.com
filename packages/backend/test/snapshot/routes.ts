import { makeFunctionReference } from "convex/server";

interface SnapshotArgs extends Record<string, string> {
  readonly releaseId: string;
  readonly snapshotJson: string;
}

interface SnapshotReceipt {
  readonly created: number;
  readonly family: "program" | "quran" | "tryout";
  readonly releaseId: string;
  readonly snapshotId: string;
  readonly unchanged: number;
}

interface SnapshotBatchArgs
  extends Record<string, number | readonly string[] | string> {
  readonly batchIndex: number;
  readonly family: "program" | "quran" | "tryout";
  readonly releaseId: string;
  readonly rowJson: readonly string[];
  readonly snapshotId: string;
}

interface SnapshotBatchReceipt {
  readonly batchIndex: number;
  readonly created: number;
  readonly family: "program" | "quran" | "tryout";
  readonly releaseId: string;
  readonly snapshotId: string;
  readonly unchanged: number;
}

/** Calls the internal snapshot-manifest staging mutation in backend tests. */
export const TEST_STAGE_SNAPSHOT = makeFunctionReference<
  "mutation",
  SnapshotArgs,
  SnapshotReceipt
>("contentRelease/snapshot/manifest:stageSnapshot");

/** Calls the internal snapshot-row staging mutation in backend tests. */
export const TEST_STAGE_SNAPSHOT_BATCH = makeFunctionReference<
  "mutation",
  SnapshotBatchArgs,
  SnapshotBatchReceipt
>("contentRelease/snapshot/batch:stageSnapshotBatch");
