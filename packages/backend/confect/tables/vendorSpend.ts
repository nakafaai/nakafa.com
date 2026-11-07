import { Table } from "@confect/core";
import { vendorSpendValidator } from "@repo/backend/confect/spend/schema";

/**
 * What each payer spent with each vendor in one month. A school's rows are
 * found by `by_tenantId_and_month`, a learner's by `by_userId_and_month`, and
 * Nakafa's own by `by_kind_and_month`; each lists the vendors of that month.
 */
export default Table.make(() => vendorSpendValidator)
  .index("by_tenantId_and_month", ["payer.tenantId", "month", "vendor"])
  .index("by_userId_and_month", ["payer.userId", "month", "vendor"])
  .index("by_kind_and_month", ["payer.kind", "month", "vendor"]);
