import { Table } from "@confect/core";
import { creditLotValidator } from "@repo/backend/confect/credits/schema";

/**
 * Top-up credit packs. `by_userId_and_state_and_expiresAt` lists one learner's
 * running packs soonest-expiring first, which is the order Nina spends them in.
 * `by_paymentId` finds the pack a payment bought, so a refund removes it.
 */
export default Table.make(() => creditLotValidator)
  .index("by_userId_and_state_and_expiresAt", ["userId", "state", "expiresAt"])
  .index("by_paymentId", ["paymentId"]);
