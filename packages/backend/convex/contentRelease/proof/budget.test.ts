import { hasProofTransactionHeadroom } from "@repo/backend/convex/contentRelease/proof/budget";
import {
  PROOF_QUERY_HEADROOM,
  TRANSACTION_READ_HEADROOM,
} from "@repo/backend/convex/contentRelease/spec";
import { describe, expect, it } from "vitest";

/** Builds measured transaction capacity for one deterministic budget test. */
function transactionMetrics(bytesRemaining: number, queryRemaining: number) {
  const available = { remaining: 1000, used: 0 };
  return {
    bytesRead: { remaining: bytesRemaining, used: 0 },
    bytesWritten: available,
    databaseQueries: { remaining: queryRemaining, used: 0 },
    documentsRead: available,
    documentsWritten: available,
    functionsScheduled: available,
    scheduledFunctionArgsBytes: available,
  };
}

describe("proof transaction budget", () => {
  it("continues only while read and query reserves remain", () => {
    expect(
      hasProofTransactionHeadroom(
        transactionMetrics(TRANSACTION_READ_HEADROOM, PROOF_QUERY_HEADROOM)
      )
    ).toBe(true);
    expect(
      hasProofTransactionHeadroom(
        transactionMetrics(
          TRANSACTION_READ_HEADROOM - 1,
          PROOF_QUERY_HEADROOM
        )
      )
    ).toBe(false);
    expect(
      hasProofTransactionHeadroom(
        transactionMetrics(
          TRANSACTION_READ_HEADROOM,
          PROOF_QUERY_HEADROOM - 1
        )
      )
    ).toBe(false);
  });
});
