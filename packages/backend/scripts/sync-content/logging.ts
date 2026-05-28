import type {
  PhaseMetrics,
  StaleItem,
  SyncMetrics,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";

export const log = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

export const logError = (message: string): void => {
  process.stderr.write(`ERROR: ${message}\n`);
};

export const logWarning = (message: string): void => {
  process.stderr.write(`WARNING: ${message}\n`);
};

export const logSuccess = (message: string): void => {
  process.stdout.write(`OK: ${message}\n`);
};

export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
};

export const formatSyncResult = (result: SyncResult): string => {
  const total = result.created + result.updated + result.unchanged;
  const parts: string[] = [];

  if (result.created > 0) {
    parts.push(`${result.created} new`);
  }

  if (result.updated > 0) {
    parts.push(`${result.updated} updated`);
  }

  if (parts.length === 0) {
    parts.push("up to date");
  }

  let output = `${total} synced (${parts.join(", ")})`;

  if (result.skipped && result.skipped > 0) {
    output += ` - ${result.skipped} skipped`;
  }

  const related: string[] = [];
  if (result.referencesCreated && result.referencesCreated > 0) {
    related.push(`${result.referencesCreated} refs`);
  }
  if (result.choicesCreated && result.choicesCreated > 0) {
    related.push(`${result.choicesCreated} choices`);
  }
  if (result.authorLinksCreated && result.authorLinksCreated > 0) {
    related.push(`${result.authorLinksCreated} author links`);
  }

  if (related.length > 0) {
    output += ` + ${related.join(", ")}`;
  }

  return output;
};

export const logPhaseMetrics = (phase: PhaseMetrics): void => {
  const duration =
    phase.durationMs === undefined ? "N/A" : formatDuration(phase.durationMs);
  const rate =
    phase.itemsPerSecond === undefined
      ? "N/A"
      : phase.itemsPerSecond.toFixed(1);
  log(
    `  ${phase.phase}: ${phase.itemCount} items in ${duration} (${rate}/sec)`
  );
};

export const logSyncMetrics = (metrics: SyncMetrics): void => {
  log("\n=== PERFORMANCE METRICS ===\n");
  for (const phase of metrics.phases) {
    logPhaseMetrics(phase);
  }

  if (
    metrics.totalDurationMs !== undefined &&
    metrics.totalItems !== undefined
  ) {
    log("---");
    log(
      `  Total: ${metrics.totalItems} items in ${formatDuration(metrics.totalDurationMs)}`
    );
    const overallRate =
      metrics.totalDurationMs > 0
        ? ((metrics.totalItems / metrics.totalDurationMs) * 1000).toFixed(1)
        : "N/A";
    log(`  Overall rate: ${overallRate} items/sec`);
  }
};

export const logStaleItems = (
  label: string,
  items: readonly StaleItem[],
  maxItems = 10
): void => {
  if (items.length === 0) {
    return;
  }

  log(`${label} (${items.length}):`);
  for (const item of items.slice(0, maxItems)) {
    log(`  - ${item.slug} (${item.locale})`);
  }

  if (items.length > maxItems) {
    log(`  ... and ${items.length - maxItems} more`);
  }
};
