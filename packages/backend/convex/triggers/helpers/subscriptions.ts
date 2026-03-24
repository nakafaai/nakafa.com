import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar";
import type { GenericMutationCtx } from "convex/server";
import { getOneFrom } from "convex-helpers/server/relationships";

const productToPlanMap: Record<string, UserPlan> = {
  [products.pro.id]: "pro",
};
const MAX_ACTIVE_SUBSCRIPTIONS_PER_CUSTOMER = 10;

/** Map one Polar product ID to the matching app plan tier. */
function getPlanFromProductId(productId: string): UserPlan {
  return productToPlanMap[productId] ?? "free";
}

/** Keep the higher-credit plan when multiple active subscriptions overlap. */
function getHigherPlan(currentPlan: UserPlan, nextPlan: UserPlan): UserPlan {
  const currentCredits = getPlanCreditConfig(currentPlan).amount;
  const nextCredits = getPlanCreditConfig(nextPlan).amount;

  return nextCredits > currentCredits ? nextPlan : currentPlan;
}

/**
 * Apply a plan change for a user and record the corresponding credit
 * transaction when credits need to be reset.
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

    return;
  }

  if (newCreditConfig.amount < oldCreditConfig.amount) {
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

    return;
  }

  await ctx.db.patch("users", userId, { plan: newPlan });

  logger.info("User plan changed (same tier)", {
    userId,
    subscriptionId,
    previousPlan: oldPlan,
    newPlan,
  });
}

/** Recompute the effective user plan for one subscription change. */
export async function syncCustomerPlan(
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
