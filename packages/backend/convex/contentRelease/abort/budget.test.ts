import { describe, expect, it } from "@effect/vitest";
import {
  ABORT_DOCUMENT_HEADROOM,
  ABORT_QUERY_HEADROOM,
  ABORT_WRITE_HEADROOM,
  hasAbortTransactionHeadroom,
} from "@repo/backend/convex/contentRelease/abort/budget";
import { TRANSACTION_READ_HEADROOM } from "@repo/backend/convex/contentRelease/spec";
import type { TransactionMetrics } from "convex/server";

/** Builds deterministic remaining capacity for one abort budget assertion. */
function transactionMetrics(
  overrides: Partial<Record<keyof TransactionMetrics, number>> = {}
): TransactionMetrics {
  const defaultRemaining = Number.MAX_SAFE_INTEGER;
  return {
    bytesRead: {
      remaining: overrides.bytesRead ?? defaultRemaining,
      used: 0,
    },
    bytesWritten: {
      remaining: overrides.bytesWritten ?? defaultRemaining,
      used: 0,
    },
    databaseQueries: {
      remaining: overrides.databaseQueries ?? defaultRemaining,
      used: 0,
    },
    documentsRead: {
      remaining: overrides.documentsRead ?? defaultRemaining,
      used: 0,
    },
    documentsWritten: {
      remaining: overrides.documentsWritten ?? defaultRemaining,
      used: 0,
    },
    functionsScheduled: {
      remaining: overrides.functionsScheduled ?? defaultRemaining,
      used: 0,
    },
    scheduledFunctionArgsBytes: {
      remaining: overrides.scheduledFunctionArgsBytes ?? defaultRemaining,
      used: 0,
    },
  };
}

describe("abort transaction budget", () => {
  it("continues only while every required reserve remains", () => {
    expect(
      hasAbortTransactionHeadroom(
        transactionMetrics({
          bytesRead: TRANSACTION_READ_HEADROOM,
          bytesWritten: ABORT_WRITE_HEADROOM,
          databaseQueries: ABORT_QUERY_HEADROOM,
          documentsRead: ABORT_DOCUMENT_HEADROOM,
          documentsWritten: ABORT_DOCUMENT_HEADROOM,
        })
      )
    ).toBe(true);

    expect(
      hasAbortTransactionHeadroom(
        transactionMetrics({ bytesRead: TRANSACTION_READ_HEADROOM - 1 })
      )
    ).toBe(false);
    expect(
      hasAbortTransactionHeadroom(
        transactionMetrics({ bytesWritten: ABORT_WRITE_HEADROOM - 1 })
      )
    ).toBe(false);
    expect(
      hasAbortTransactionHeadroom(
        transactionMetrics({ databaseQueries: ABORT_QUERY_HEADROOM - 1 })
      )
    ).toBe(false);
    expect(
      hasAbortTransactionHeadroom(
        transactionMetrics({ documentsRead: ABORT_DOCUMENT_HEADROOM - 1 })
      )
    ).toBe(false);
    expect(
      hasAbortTransactionHeadroom(
        transactionMetrics({ documentsWritten: ABORT_DOCUMENT_HEADROOM - 1 })
      )
    ).toBe(false);
  });
});
