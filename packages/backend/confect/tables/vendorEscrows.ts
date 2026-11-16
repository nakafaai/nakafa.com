import { Table } from "@confect/core";
import { vendorEscrowValidator } from "@repo/backend/confect/spend/schema";

/**
 * One escrow per metered call, held before the call and settled after it.
 * `foldSpend` finds the escrows its rows do not count yet by
 * `by_counted_and_status`: those that count nothing, and those that count a
 * hold and have settled.
 */
export default Table.make(() => vendorEscrowValidator).index(
  "by_counted_and_status",
  ["counted", "state.status"]
);
