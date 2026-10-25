import { Table } from "@confect/core";
import { billingEventValidator } from "@repo/backend/confect/billing/schema";

/**
 * The webhook inbox. A row is written before its event is processed, and
 * `by_rail_and_key` makes a redelivery a no-op. The sweep reads
 * `by_rail_and_processedAt_and_receivedAt` for Polar rows still unprocessed,
 * oldest first. Cleanup reads `by_processedAt` for processed rows past the
 * retention window, and `by_receivedAt` to find unprocessed rows that outlived
 * every provider retry.
 */
export default Table.make(() => billingEventValidator)
  .index("by_rail_and_key", ["rail", "key"])
  .index("by_receivedAt", ["receivedAt"])
  .index("by_processedAt", ["processedAt"])
  .index("by_rail_and_processedAt_and_receivedAt", [
    "rail",
    "processedAt",
    "receivedAt",
  ]);
