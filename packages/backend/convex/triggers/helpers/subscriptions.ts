import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import {
  resolveCurrentCreditResetTimestamp,
  resolveEffectiveCreditState,
} from "@repo/backend/convex/credits/helpers/state";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar/products";
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
  user: DataModel["users"]["document"],
  newPlan: UserPlan,
  subscriptionId: string
) {
  const oldCreditConfig = getPlanCreditConfig(user.plan);
  const newCreditConfig = getPlanCreditConfig(newPlan);
  const nextResetTimestamp = await resolveCurrentCreditResetTimestamp(
    ctx.db,
    newPlan,
    Date.now()
  );

  if (newCreditConfig.amount > oldCreditConfig.amount) {
    await ctx.db.patch("users", user._id, {
      plan: newPlan,
      credits: newCreditConfig.amount,
      creditsResetAt: nextResetTimestamp,
    });

    await ctx.db.insert("creditTransactions", {
      userId: user._id,
      amount: newCreditConfig.amount,
      type: "purchase",
      balanceAfter: newCreditConfig.amount,
      metadata: {
        reason: "plan-upgrade",
        "previous-plan": user.plan,
        "new-plan": newPlan,
        "subscription-id": subscriptionId,
      },
    });

    logger.info("User upgraded with credits", {
      userId: user._id,
      subscriptionId,
      creditsGranted: newCreditConfig.amount,
      previousPlan: user.plan,
      newPlan,
    });

    return;
  }

  if (newCreditConfig.amount < oldCreditConfig.amount) {
    await ctx.db.patch("users", user._id, {
      plan: newPlan,
      credits: newCreditConfig.amount,
      creditsResetAt: nextResetTimestamp,
    });

    await ctx.db.insert("creditTransactions", {
      userId: user._id,
      amount: newCreditConfig.amount,
      type: newCreditConfig.grantType,
      balanceAfter: newCreditConfig.amount,
      metadata: {
        reason: "plan-downgrade",
        "previous-plan": user.plan,
        "new-plan": newPlan,
        "subscription-id": subscriptionId,
      },
    });

    logger.info("User downgraded, credits adjusted", {
      userId: user._id,
      subscriptionId,
      newCredits: newCreditConfig.amount,
      previousPlan: user.plan,
      newPlan,
    });

    return;
  }

  const effectiveCredits = await resolveEffectiveCreditState(
    ctx.db,
    user,
    Date.now()
  );

  await ctx.db.patch("users", user._id, {
    plan: newPlan,
    credits: effectiveCredits.credits,
    creditsResetAt: effectiveCredits.creditsResetAt,
  });

  logger.info("User plan changed (same tier)", {
    userId: user._id,
    subscriptionId,
    previousPlan: user.plan,
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

  await applyPlanChange(ctx, user, newPlan, subscription.id);
}
