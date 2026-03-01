import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Maps Polar product IDs to plan tiers. Add new plans here.
 */
const productToPlanMap: Record<string, UserPlan> = {
  [products.pro.id]: "pro",
};

function getPlanFromProductId(productId: string): UserPlan {
  return productToPlanMap[productId] ?? "free";
}

/**
 * Updates user.plan when subscription changes.
 */
export async function subscriptionsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "subscriptions">
) {
  switch (change.operation) {
    case "insert":
    case "update": {
      const subscription = change.newDoc;

      if (!subscription) {
        break;
      }

      const customer = await ctx.db
        .query("customers")
        .withIndex("id", (q) => q.eq("id", subscription.customerId))
        .unique();

      if (!customer) {
        logger.warn("Subscription trigger: Customer not found", {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
        });
        break;
      }

      const isActive = subscription.status === "active";
      const plan = isActive
        ? getPlanFromProductId(subscription.productId)
        : "free";
      await ctx.db.patch("users", customer.userId, { plan });

      logger.info("User plan updated from subscription", {
        userId: customer.userId,
        subscriptionId: subscription.id,
        productId: subscription.productId,
        plan,
      });
      break;
    }

    case "delete": {
      break;
    }

    default: {
      break;
    }
  }
}
