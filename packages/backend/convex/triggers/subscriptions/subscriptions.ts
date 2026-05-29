import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { syncCustomerPlan } from "@repo/backend/convex/triggers/subscriptions/impl";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Updates user.plan and credits when subscription changes.
 * Handles upgrades (immediate credit grant) and downgrades.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */
export async function subscriptionsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "subscriptions">
) {
  const subscription =
    change.operation === "delete" ? change.oldDoc : change.newDoc;

  await runConvexProgram(syncCustomerPlan(ctx, subscription));
}
