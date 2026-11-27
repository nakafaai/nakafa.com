import { describe, expect, it } from "@effect/vitest";
import {
  hasProofTransactionHeadroom,
  hasVerifyHeadroom,
} from "@repo/backend/confect/contentRelease/proof/budget";
import {
  PROOF_QUERY_HEADROOM,
  TRANSACTION_READ_HEADROOM,
  VERIFY_PAGE_BYTES,
} from "@repo/backend/confect/contentRelease/spec";

/** Builds measured transaction capacity for one deterministic budget test. */
function transactionMetrics(
  bytesRemaining: number,
  queryRemaining: number,
  bytesUsed = 0
) {
  const available = { remaining: 1000, used: 0 };
  return {
    bytesRead: { remaining: bytesRemaining, used: bytesUsed },
    bytesWritten: available,
    databaseQueries: { remaining: queryRemaining, used: 0 },
    documentsRead: available,
    documentsWritten: available,
    functionsScheduled: available,
    scheduledFunctionArgsBytes: available,
    fileReadBytes: available,
    fileWriteBytes: available,
    filesRead: available,
    filesWritten: available,
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
        transactionMetrics(TRANSACTION_READ_HEADROOM - 1, PROOF_QUERY_HEADROOM)
      )
    ).toBe(false);
    expect(
      hasProofTransactionHeadroom(
        transactionMetrics(TRANSACTION_READ_HEADROOM, PROOF_QUERY_HEADROOM - 1)
      )
    ).toBe(false);
  });

  it("verifies another item only below the verification read budget", () => {
    const reserves = [TRANSACTION_READ_HEADROOM, PROOF_QUERY_HEADROOM] as const;
    expect(
      hasVerifyHeadroom(transactionMetrics(...reserves, VERIFY_PAGE_BYTES - 1))
    ).toBe(true);
    expect(
      hasVerifyHeadroom(transactionMetrics(...reserves, VERIFY_PAGE_BYTES))
    ).toBe(false);
    expect(
      hasVerifyHeadroom(
        transactionMetrics(TRANSACTION_READ_HEADROOM, PROOF_QUERY_HEADROOM - 1)
      )
    ).toBe(false);
  });
});
