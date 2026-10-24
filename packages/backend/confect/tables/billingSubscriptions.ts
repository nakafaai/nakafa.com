import { Table } from "@confect/core";
import { billingSubscriptionValidator } from "@repo/backend/confect/billing/schema";

/**
 * Recurring subscriptions. A provider webhook finds its row by the provider's
 * own reference: `by_polar_subscriptionId` for Polar, `by_xendit_planId` for Xendit.
 */
export default Table.make(() => billingSubscriptionValidator)
  .index("by_accountId_and_status", ["accountId", "status"])
  .index("by_polar_subscriptionId", ["provider.subscriptionId"])
  .index("by_xendit_planId", ["provider.planId"]);
