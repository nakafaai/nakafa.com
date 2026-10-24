import { Table } from "@confect/core";
import { billingAccountValidator } from "@repo/backend/confect/billing/schema";

/**
 * Who pays. A person's account and a school's account are separate rows, and
 * each keeps the rail and currency it was made with. `by_rail_and_providerCustomerId`
 * finds the account a provider webhook names.
 */
export default Table.make(() => billingAccountValidator)
  .index("by_userId_and_rail", ["owner.userId", "rail"])
  .index("by_tenantId_and_rail", ["owner.tenantId", "rail"])
  .index("by_rail_and_providerCustomerId", ["rail", "providerCustomerId"]);
