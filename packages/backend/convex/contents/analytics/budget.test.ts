import { describe, expect, it } from "@effect/vitest";
import {
  CONTENT_ANALYTICS_HEADROOM,
  hasContentAnalyticsHeadroom,
} from "@repo/backend/convex/contents/analytics/budget";
import type { TransactionMetrics } from "convex/server";

/** Builds one complete transaction metric fixture at configured reserves. */
function transactionMetrics(
  overrides: Partial<Record<keyof TransactionMetrics, number>> = {}
): TransactionMetrics {
  const metric = (key: keyof TransactionMetrics) => ({
    remaining: overrides[key] ?? CONTENT_ANALYTICS_HEADROOM[key],
    used: 0,
  });

  return {
    bytesRead: metric("bytesRead"),
    bytesWritten: metric("bytesWritten"),
    databaseQueries: metric("databaseQueries"),
    documentsRead: metric("documentsRead"),
    documentsWritten: metric("documentsWritten"),
    functionsScheduled: metric("functionsScheduled"),
    scheduledFunctionArgsBytes: metric("scheduledFunctionArgsBytes"),
  };
}

describe("content analytics transaction budget", () => {
  it("continues only while every transaction reserve remains", () => {
    expect(hasContentAnalyticsHeadroom(transactionMetrics())).toBe(true);

    for (const key of Object.keys(
      CONTENT_ANALYTICS_HEADROOM
    ) as (keyof TransactionMetrics)[]) {
      expect(
        hasContentAnalyticsHeadroom(
          transactionMetrics({ [key]: CONTENT_ANALYTICS_HEADROOM[key] - 1 })
        )
      ).toBe(false);
    }
  });
});
