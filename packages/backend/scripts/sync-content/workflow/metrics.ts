import { formatDuration } from "@repo/backend/scripts/sync-content/cli/logging";
import type {
  BatchProgress,
  PhaseMetrics,
  SyncMetrics,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";

/** Starts a metrics object for one sync command invocation. */
export const createMetrics = (): SyncMetrics => ({
  phases: [],
  totalStartTime: performance.now(),
});

/** Starts timing one named sync phase and attaches it to the command metrics. */
export const startPhase = (
  metrics: SyncMetrics,
  phase: string
): PhaseMetrics => {
  const phaseMetrics: PhaseMetrics = {
    phase,
    itemCount: 0,
    startTime: performance.now(),
  };
  metrics.phases.push(phaseMetrics);
  return phaseMetrics;
};

/** Completes one phase measurement using the final item count. */
export const endPhase = (phase: PhaseMetrics, itemCount: number): void => {
  phase.endTime = performance.now();
  phase.itemCount = itemCount;
  phase.durationMs = phase.endTime - phase.startTime;
  phase.itemsPerSecond =
    phase.durationMs > 0 ? (itemCount / phase.durationMs) * 1000 : 0;
};

/** Adds metrics from a phase that already measured its own duration. */
export const addPhaseMetrics = (
  metrics: SyncMetrics,
  phaseName: string,
  result: SyncResult
): void => {
  metrics.phases.push({
    phase: phaseName,
    startTime: 0,
    itemCount: result.created + result.updated + result.unchanged,
    durationMs: result.durationMs,
    itemsPerSecond: result.itemsPerSecond,
  });
};

/** Finalizes aggregate duration and item counts for a sync command. */
export const finalizeMetrics = (metrics: SyncMetrics): void => {
  metrics.totalEndTime = performance.now();
  metrics.totalDurationMs = metrics.totalEndTime - metrics.totalStartTime;
  metrics.totalItems = metrics.phases.reduce(
    (sum, phase) => sum + phase.itemCount,
    0
  );
};

/** Creates progress state for a known-size batch operation. */
export const createBatchProgress = (
  totalItems: number,
  batchSize: number
): BatchProgress => ({
  totalItems,
  processedItems: 0,
  batchSize,
  startTime: performance.now(),
});

/** Advances a batch progress counter after a batch writes successfully. */
export const updateBatchProgress = (
  progress: BatchProgress,
  batchItemCount: number
): void => {
  progress.processedItems += batchItemCount;
};

/** Formats bounded batch progress and ETA for long-running sync phases. */
export const formatBatchProgress = (
  progress: BatchProgress,
  batchNum: number,
  totalBatches: number,
  batchItemCount: number
): string => {
  const percentage = (
    (progress.processedItems / progress.totalItems) *
    100
  ).toFixed(0);
  const elapsed = performance.now() - progress.startTime;

  let eta = "";
  if (
    progress.processedItems > 0 &&
    progress.processedItems < progress.totalItems
  ) {
    const rate = progress.processedItems / elapsed;
    const remaining = progress.totalItems - progress.processedItems;
    eta = ` ETA: ${formatDuration(remaining / rate)}`;
  }

  return `Batch ${batchNum}/${totalBatches} (${batchItemCount} items) [${percentage}%]${eta}`;
};
