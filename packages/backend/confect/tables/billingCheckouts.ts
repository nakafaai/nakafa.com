import { Table } from "@confect/core";
import { billingCheckoutValidator } from "@repo/backend/confect/billing/schema";

/**
 * Hosted checkouts a rail holds open. `by_rail_and_sessionId` finds the checkout a
 * session webhook names, and `by_accountId_and_status` the open ones of a payer.
 */
export default Table.make(() => billingCheckoutValidator)
  .index("by_rail_and_sessionId", ["rail", "sessionId"])
  .index("by_accountId_and_status", ["accountId", "status"]);
