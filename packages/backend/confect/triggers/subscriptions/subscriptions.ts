import { syncCustomerPlan } from "@repo/backend/confect/triggers/subscriptions/impl";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/**
 * Updates user.plan and credits when subscription changes.
 * Handles upgrades (immediate credit grant) and downgrades.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */
export const subscriptionsHandler = Effect.fn(
  "triggers.subscriptions.subscriptions.subscriptionsHandler"
)(function* (change: Change<DataModel, "subscriptions">) {
  const subscription =
    change.operation === "delete" ? change.oldDoc : change.newDoc;
  yield* syncCustomerPlan(subscription);
});
