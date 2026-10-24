import { Table } from "@confect/core";
import { billingPaymentValidator } from "@repo/backend/confect/billing/schema";

/**
 * Money received. `by_rail_and_providerPaymentId` is unique in the mutation that
 * records a payment, so a replayed webhook records it once.
 */
export default Table.make(() => billingPaymentValidator)
  .index("by_rail_and_providerPaymentId", ["rail", "providerPaymentId"])
  .index("by_accountId_and_paidAt", ["accountId", "paidAt"]);
