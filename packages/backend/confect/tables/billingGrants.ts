import { Table } from "@confect/core";
import { billingGrantValidator } from "@repo/backend/confect/billing/schema";

/**
 * Time-bounded rights to Pro. Each subscription, pass, invoice or contract writes
 * its own grant, and the indexes find a source's grant to renew or end it, and
 * the grants a user or a school holds at a time.
 */
export default Table.make(() => billingGrantValidator)
  .index("by_userId_and_validTo", ["userId", "validTo"])
  .index("by_tenantId_and_validTo", ["tenantId", "validTo"])
  .index("by_source_subscriptionId", ["source.subscriptionId"])
  .index("by_source_contractId", ["source.contractId"]);
