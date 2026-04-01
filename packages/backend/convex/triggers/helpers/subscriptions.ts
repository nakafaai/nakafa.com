import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  getCurrentCreditResetTimestamp,
  getEffectiveCreditState,
  getPlanCreditConfig,
} from "@repo/backend/convex/credits/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import type { UserPlan } from "@repo/backend/convex/users/schema";
import { userWriteWorkpool } from "@repo/backend/convex/users/workpool";
import { logger } from "@repo/backend/convex/utils/logger";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
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

/** Recompute and apply the effective plan inside the serialized user writer. */
export const syncUserPlanState = internalMutation({
  args: {
    customerId: v.string(),
    subscriptionId: v.string(),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    const activeSubscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status", (q) =>
        q.eq("customerId", args.customerId).eq("status", "active")
      )
      .take(MAX_ACTIVE_SUBSCRIPTIONS_PER_CUSTOMER);

    const newPlan = activeSubscriptions.reduce<UserPlan>((highestPlan, row) => {
      return getHigherPlan(highestPlan, getPlanFromProductId(row.productId));
    }, "free");

    if (newPlan === user.plan) {
      return null;
    }

    const oldCreditConfig = getPlanCreditConfig(user.plan);
    const newCreditConfig = getPlanCreditConfig(newPlan);
    const effectiveState = getEffectiveCreditState(user);
    const resetTimestamp = getCurrentCreditResetTimestamp(newPlan);

    const nextCredits =
      newCreditConfig.amount > oldCreditConfig.amount ||
      newCreditConfig.amount < oldCreditConfig.amount
        ? newCreditConfig.amount
        : effectiveState.credits;

    await ctx.db.patch("users", args.userId, {
      plan: newPlan,
      credits: nextCredits,
      creditsResetAt:
        newCreditConfig.amount === oldCreditConfig.amount
          ? effectiveState.creditsResetAt
          : resetTimestamp,
    });

    if (newCreditConfig.amount === oldCreditConfig.amount) {
      logger.info("User plan changed (same tier)", {
        userId: args.userId,
        subscriptionId: args.subscriptionId,
        previousPlan: user.plan,
        newPlan,
      });

      return null;
    }

    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      amount: newCreditConfig.amount,
      type:
        newCreditConfig.amount > oldCreditConfig.amount
          ? "purchase"
          : newCreditConfig.grantType,
      balanceAfter: nextCredits,
      metadata: {
        reason:
          newCreditConfig.amount > oldCreditConfig.amount
            ? "plan-upgrade"
            : "plan-downgrade",
        "new-plan": newPlan,
        "previous-plan": user.plan,
        "subscription-id": args.subscriptionId,
      },
    });

    logger.info(
      newCreditConfig.amount > oldCreditConfig.amount
        ? "User upgraded with credits"
        : "User downgraded, credits adjusted",
      {
        userId: args.userId,
        subscriptionId: args.subscriptionId,
        previousPlan: user.plan,
        newPlan,
      }
    );

    return null;
  },
});

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

  await userWriteWorkpool.enqueueMutation(
    ctx,
    internal.triggers.helpers.subscriptions.syncUserPlanState,
    {
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
      userId: customer.userId,
    }
  );
}
