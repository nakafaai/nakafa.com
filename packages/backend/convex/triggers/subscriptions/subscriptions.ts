import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { syncCustomerPlan } from "@repo/backend/convex/triggers/helpers/subscriptions";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Updates user.plan and credits when subscription changes.
 * Handles upgrades (immediate credit grant) and downgrades.
 */
export async function subscriptionsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "subscriptions">
) {
  switch (change.operation) {
    case "insert": {
      const subscription = change.newDoc;

      if (!subscription) {
        break;
      }
      await syncCustomerPlan(ctx, subscription);

      break;
    }

    case "update": {
      const subscription = change.newDoc;

      if (!subscription) {
        break;
      }

      await syncCustomerPlan(ctx, subscription);

      break;
    }

    case "delete": {
      const subscription = change.oldDoc;

      if (!subscription) {
        break;
      }

      await syncCustomerPlan(ctx, subscription);

      break;
    }

    default: {
      break;
    }
  }
}
