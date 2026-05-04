import { formatDuration } from "@repo/backend/scripts/sync-content/logging";
import type {
  BatchProgress,
  PhaseMetrics,
  SyncMetrics,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";

export const createMetrics = (): SyncMetrics => ({
  phases: [],
  totalStartTime: performance.now(),
});

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

export const endPhase = (phase: PhaseMetrics, itemCount: number): void => {
  phase.endTime = performance.now();
  phase.itemCount = itemCount;
  phase.durationMs = phase.endTime - phase.startTime;
  phase.itemsPerSecond =
    phase.durationMs > 0 ? (itemCount / phase.durationMs) * 1000 : 0;
};

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

export const finalizeMetrics = (metrics: SyncMetrics): void => {
  metrics.totalEndTime = performance.now();
  metrics.totalDurationMs = metrics.totalEndTime - metrics.totalStartTime;
  metrics.totalItems = metrics.phases.reduce(
    (sum, phase) => sum + phase.itemCount,
    0
  );
};

export const createBatchProgress = (
  totalItems: number,
  batchSize: number
): BatchProgress => ({
  totalItems,
  processedItems: 0,
  batchSize,
  startTime: performance.now(),
});

export const updateBatchProgress = (
  progress: BatchProgress,
  batchItemCount: number
): void => {
  progress.processedItems += batchItemCount;
};

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
