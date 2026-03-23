import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar";
import type { GenericMutationCtx } from "convex/server";
import { getOneFrom } from "convex-helpers/server/relationships";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Maps Polar product IDs to plan tiers. Add new plans here.
 */
const productToPlanMap: Record<string, UserPlan> = {
  [products.pro.id]: "pro",
};
const MAX_ACTIVE_SUBSCRIPTIONS_PER_CUSTOMER = 10;

function getPlanFromProductId(productId: string): UserPlan {
  return productToPlanMap[productId] ?? "free";
}

function getHigherPlan(currentPlan: UserPlan, nextPlan: UserPlan): UserPlan {
  const currentCredits = getPlanCreditConfig(currentPlan).amount;
  const nextCredits = getPlanCreditConfig(nextPlan).amount;

  return nextCredits > currentCredits ? nextPlan : currentPlan;
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

async function syncCustomerPlan(
  ctx: GenericMutationCtx<DataModel>,
  subscription: DataModel["subscriptions"]["document"]
) {
  const customer = await getOneFrom(
    ctx.db,
    "customers",
    "by_polarId",
    subscription.customerId,
    "id"
  );

  if (!customer) {
    logger.warn("Subscription trigger: Customer not found", {
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
    });
    return;
  }

  const user = await ctx.db.get("users", customer.userId);

  if (!user) {
    logger.warn("Subscription trigger: User not found", {
      userId: customer.userId,
      subscriptionId: subscription.id,
    });
    return;
  }

  const activeSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_customerId_and_status", (q) =>
      q.eq("customerId", subscription.customerId).eq("status", "active")
    )
    .take(MAX_ACTIVE_SUBSCRIPTIONS_PER_CUSTOMER);

  const newPlan = activeSubscriptions.reduce<UserPlan>((highestPlan, row) => {
    return getHigherPlan(highestPlan, getPlanFromProductId(row.productId));
  }, "free");

  if (newPlan === user.plan) {
    return;
  }

  await applyPlanChange(
    ctx,
    customer.userId,
    user.plan,
    newPlan,
    subscription.id
  );
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
