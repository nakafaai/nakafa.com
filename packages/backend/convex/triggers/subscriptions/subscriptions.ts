import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
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
 * Determine effective plan based on subscription status.
 * Handles Polar's cancel-at-period-end behavior.
 */
function getEffectivePlan(
  subscription: DataModel["subscriptions"]["document"]
): UserPlan {
  // Only grant paid plan if currently active
  // cancelAtPeriodEnd=true means still active until period ends
  if (subscription.status === "active") {
    return getPlanFromProductId(subscription.productId);
  }

  return "free";
}

/**
 * Applies a plan change for a user: patches plan/credits and inserts a
 * creditTransactions record. Handles upgrade, downgrade, and same-tier transitions.
 */
async function applyPlanChange(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<"users">,
  oldPlan: UserPlan,
  newPlan: UserPlan,
  subscriptionId: string
) {
  const oldCreditConfig = getPlanCreditConfig(oldPlan);
  const newCreditConfig = getPlanCreditConfig(newPlan);

  if (newCreditConfig.amount > oldCreditConfig.amount) {
    // UPGRADE: New plan has more credits
    await ctx.db.patch("users", userId, {
      plan: newPlan,
      credits: newCreditConfig.amount,
      creditsResetAt: Date.now(),
    });

    await ctx.db.insert("creditTransactions", {
      userId,
      amount: newCreditConfig.amount,
      type: "purchase",
      balanceAfter: newCreditConfig.amount,
      metadata: {
        reason: "plan-upgrade",
        "previous-plan": oldPlan,
        "new-plan": newPlan,
        "subscription-id": subscriptionId,
      },
    });

    logger.info("User upgraded with credits", {
      userId,
      subscriptionId,
      creditsGranted: newCreditConfig.amount,
      previousPlan: oldPlan,
      newPlan,
    });
  } else if (newCreditConfig.amount < oldCreditConfig.amount) {
    // DOWNGRADE: New plan has fewer credits
    await ctx.db.patch("users", userId, {
      plan: newPlan,
      credits: newCreditConfig.amount,
      creditsResetAt: Date.now(),
    });

    await ctx.db.insert("creditTransactions", {
      userId,
      amount: newCreditConfig.amount,
      type: newCreditConfig.grantType,
      balanceAfter: newCreditConfig.amount,
      metadata: {
        reason: "plan-downgrade",
        "previous-plan": oldPlan,
        "new-plan": newPlan,
        "subscription-id": subscriptionId,
      },
    });

    logger.info("User downgraded, credits adjusted", {
      userId,
      subscriptionId,
      newCredits: newCreditConfig.amount,
      previousPlan: oldPlan,
      newPlan,
    });
  } else {
    // Same credit amount (e.g., pro monthly -> pro yearly) - just update plan
    await ctx.db.patch("users", userId, { plan: newPlan });

    logger.info("User plan changed (same tier)", {
      userId,
      subscriptionId,
      previousPlan: oldPlan,
      newPlan,
    });
  }
}

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

      const newPlan = getEffectivePlan(subscription);
      const user = await ctx.db.get("users", customer.userId);

      if (!user) {
        logger.warn("Subscription trigger: User not found", {
          userId: customer.userId,
          subscriptionId: subscription.id,
        });
        break;
      }

      await applyPlanChange(
        ctx,
        customer.userId,
        user.plan,
        newPlan,
        subscription.id
      );

      break;
    }

    case "update": {
      const subscription = change.newDoc;
      const oldSubscription = change.oldDoc;

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

      const newPlan = getEffectivePlan(subscription);
      const oldPlan = oldSubscription
        ? getEffectivePlan(oldSubscription)
        : "free";

      if (newPlan === oldPlan) {
        // No plan change, just update the plan field in case
        await ctx.db.patch("users", customer.userId, { plan: newPlan });
        break;
      }

      const user = await ctx.db.get("users", customer.userId);

      if (!user) {
        logger.warn("Subscription trigger: User not found", {
          userId: customer.userId,
          subscriptionId: subscription.id,
        });
        break;
      }

      await applyPlanChange(
        ctx,
        customer.userId,
        oldPlan,
        newPlan,
        subscription.id
      );

      break;
    }

    case "delete": {
      // Subscription deleted - user goes back to free
      const subscription = change.oldDoc;

      if (!subscription) {
        break;
      }

      const customer = await ctx.db
        .query("customers")
        .withIndex("id", (q) => q.eq("id", subscription.customerId))
        .unique();

      if (!customer) {
        break;
      }

      const creditConfig = getPlanCreditConfig("free");

      await ctx.db.patch("users", customer.userId, {
        plan: "free",
        credits: creditConfig.amount,
        creditsResetAt: Date.now(),
      });

      logger.info("Subscription deleted, user reset to free", {
        userId: customer.userId,
        subscriptionId: subscription.id,
      });

      break;
    }

    default: {
      break;
    }
  }
}
