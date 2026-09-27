import type { TransactionMetrics } from "convex/server";

/** Maximum queue bytes loaded before per-identity work begins. */
export const CONTENT_ANALYTICS_PAGE_BYTES = 2 * 1024 * 1024;

/** Maximum queued views folded into one atomic popularity identity update. */
export const CONTENT_ANALYTICS_GROUP_SIZE = 8;

/** Capacity proven for one more identity group plus worker finalization. */
export const CONTENT_ANALYTICS_HEADROOM = {
  bytesRead: 2 * 1024 * 1024,
  bytesWritten: 2 * 1024 * 1024,
  databaseQueries: 512,
  documentsRead: 2048,
  documentsWritten: 512,
  functionsScheduled: 2,
  scheduledFunctionArgsBytes: 2048,
} as const satisfies Record<keyof TransactionMetrics, number>;

/** Capacity retained after the final group for lease and scheduler writes. */
export const CONTENT_ANALYTICS_FINALIZATION_RESERVE = {
  bytesRead: 64 * 1024,
  bytesWritten: 256 * 1024,
  databaseQueries: 8,
  documentsRead: 8,
  documentsWritten: 32,
  functionsScheduled: 1,
  scheduledFunctionArgsBytes: 1024,
} as const satisfies Record<keyof TransactionMetrics, number>;

/** Stops the drain unless every transaction resource retains its reserve. */
export function hasContentAnalyticsHeadroom(metrics: TransactionMetrics) {
  return (
    metrics.bytesRead.remaining >= CONTENT_ANALYTICS_HEADROOM.bytesRead &&
    metrics.bytesWritten.remaining >= CONTENT_ANALYTICS_HEADROOM.bytesWritten &&
    metrics.databaseQueries.remaining >=
      CONTENT_ANALYTICS_HEADROOM.databaseQueries &&
    metrics.documentsRead.remaining >=
      CONTENT_ANALYTICS_HEADROOM.documentsRead &&
    metrics.documentsWritten.remaining >=
      CONTENT_ANALYTICS_HEADROOM.documentsWritten &&
    metrics.functionsScheduled.remaining >=
      CONTENT_ANALYTICS_HEADROOM.functionsScheduled &&
    metrics.scheduledFunctionArgsBytes.remaining >=
      CONTENT_ANALYTICS_HEADROOM.scheduledFunctionArgsBytes
  );
}
