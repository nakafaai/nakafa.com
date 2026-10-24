import { Table } from "@confect/core";
import { billingInvoiceValidator } from "@repo/backend/confect/billing/schema";

/** School and Enterprise invoices. `by_number` finds one from the number a buyer quotes. */
export default Table.make(() => billingInvoiceValidator)
  .index("by_accountId_and_status", ["accountId", "status"])
  .index("by_number", ["number"]);
