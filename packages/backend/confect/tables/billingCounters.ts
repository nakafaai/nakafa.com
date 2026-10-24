import { Table } from "@confect/core";
import { billingCounterValidator } from "@repo/backend/confect/billing/schema";

/** One row per year. The invoice numbering reads and advances it inside one mutation. */
export default Table.make(() => billingCounterValidator).index("by_year", [
  "year",
]);
