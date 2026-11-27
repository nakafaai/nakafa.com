/** Checks measured transaction capacity before reading another proof record. */
import {
  PROOF_QUERY_HEADROOM,
  TRANSACTION_READ_HEADROOM,
  VERIFY_PAGE_BYTES,
} from "@repo/backend/confect/contentRelease/spec";
import type { TransactionMetrics } from "convex/server";
/** Checks measured transaction capacity before reading another proof record. */
export function hasProofTransactionHeadroom(metrics: TransactionMetrics) {
  return (
    metrics.bytesRead.remaining >= TRANSACTION_READ_HEADROOM &&
    metrics.databaseQueries.remaining >= PROOF_QUERY_HEADROOM
  );
}

/**
 * Checks measured transaction capacity before verifying another staged item:
 * the proof reserves, and a read budget that keeps the mutation inside its
 * execution time.
 */
export function hasVerifyHeadroom(metrics: TransactionMetrics) {
  return (
    hasProofTransactionHeadroom(metrics) &&
    metrics.bytesRead.used < VERIFY_PAGE_BYTES
  );
}
