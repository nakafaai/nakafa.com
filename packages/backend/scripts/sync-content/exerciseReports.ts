import {
  formatDuration,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import type {
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";

/** Prints exercise question sync counters and mismatch diagnostics. */
export function reportQuestionSyncResults(
  totals: SyncResult,
  questionFilesLength: number,
  questionsLength: number,
  durationMs: number,
  options: SyncOptions
) {
  const processed = totals.created + totals.updated + totals.unchanged;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (options.quiet) {
    return;
  }

  log(
    `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
  );

  if (totals.skipped && totals.skipped > 0) {
    logError(`${totals.skipped} questions SKIPPED (missing exercise sets)`);
    const uniqueSets = [...new Set(totals.skippedSetSlugs || [])];
    logError(
      `Missing sets: ${uniqueSets.map((slug) => slug.replace("exercises/", "")).join(", ")}`
    );
    logError("Add these sets to your material files in _data/*-material.ts");
  }

  if (totals.choicesCreated || totals.authorLinksCreated) {
    log(
      `Related: ${totals.choicesCreated || 0} choices, ${totals.authorLinksCreated || 0} author links`
    );
  }

  log(
    `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
  );

  const totalProcessed = processed + (totals.skipped || 0);
  if (totalProcessed === questionsLength && !totals.skipped) {
    logSuccess(`${processed}/${questionFilesLength} exercise questions synced`);
    return;
  }

  if (totals.skipped) {
    logError(
      `Processed: ${processed} synced, ${totals.skipped} skipped vs ${questionsLength} parsed`
    );
    return;
  }

  logError(`Mismatch: ${processed} processed vs ${questionsLength} parsed`);
}
