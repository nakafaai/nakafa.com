import { Table } from "@confect/core";
import { subscriptionValidator } from "@repo/backend/confect/notifications/subscription";

/** The push subscriptions of each account, oldest first, and each one found by its endpoint. */
export default Table.make(() => subscriptionValidator)
  .index("by_userId", ["userId"])
  .index("by_endpoint", ["endpoint"]);
