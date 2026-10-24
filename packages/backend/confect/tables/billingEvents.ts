import { Table } from "@confect/core";
import { billingEventValidator } from "@repo/backend/confect/billing/schema";

/**
 * The webhook inbox. A row is written before its event is processed, and
 * `by_rail_and_key` makes a redelivery a no-op. Cleanup reads `by_receivedAt`:
 * an unprocessed row older than the 90-day window has outlived every provider retry.
 */
export default Table.make(() => billingEventValidator)
  .index("by_rail_and_key", ["rail", "key"])
  .index("by_receivedAt", ["receivedAt"]);
