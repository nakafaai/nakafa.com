import { TRANSACTION_READ_HEADROOM } from "@repo/backend/convex/contentRelease/spec";
import type { TransactionMetrics } from "convex/server";

/** Maximum small release rows considered by one abort transaction. */
export const ABORT_PAGE_LIMIT = 256;

/** Maximum source bytes loaded before abort work measures remaining capacity. */
export const ABORT_PAGE_BYTES = 4 * 1024 * 1024;

/** Capacity reserved for the next row plus terminal release state writes. */
export const ABORT_WRITE_HEADROOM = 4 * 1024 * 1024;

/** Query capacity reserved for ownership checks and terminal validation. */
export const ABORT_QUERY_HEADROOM = 32;

/** Document capacity reserved for ownership checks and terminal validation. */
export const ABORT_DOCUMENT_HEADROOM = 32;

/** Checks measured transaction capacity before deleting another release row. */
export function hasAbortTransactionHeadroom(metrics: TransactionMetrics) {
  return (
    metrics.bytesRead.remaining >= TRANSACTION_READ_HEADROOM &&
    metrics.bytesWritten.remaining >= ABORT_WRITE_HEADROOM &&
    metrics.databaseQueries.remaining >= ABORT_QUERY_HEADROOM &&
    metrics.documentsRead.remaining >= ABORT_DOCUMENT_HEADROOM &&
    metrics.documentsWritten.remaining >= ABORT_DOCUMENT_HEADROOM
  );
}
