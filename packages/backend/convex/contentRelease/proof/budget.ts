import {
  PROOF_QUERY_HEADROOM,
  TRANSACTION_READ_HEADROOM,
} from "@repo/backend/convex/contentRelease/spec";
import type { TransactionMetrics } from "convex/server";

/** Checks measured transaction capacity before reading another proof record. */
export function hasProofTransactionHeadroom(metrics: TransactionMetrics) {
  return (
    metrics.bytesRead.remaining >= TRANSACTION_READ_HEADROOM &&
    metrics.databaseQueries.remaining >= PROOF_QUERY_HEADROOM
  );
}
